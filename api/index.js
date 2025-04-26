import express from 'express';
import cors from 'cors';
import Imap from 'imap'; // Use node-imap
import { simpleParser } from 'mailparser'; // Import mailparser
// import { simpleParser } from 'mailparser'; // Needed to parse fetched message bodies - Removed as not currently used

console.log('[api/index.js] Module loaded by Vercel runtime.');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Simple root route to indicate server is running (for wait-on)
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint to receive client-side logs
app.post('/api/log', (req, res) => {
  const { level = 'log', message } = req.body;
  if (message) {
    // Prefix logs to indicate they came from the client
    const logPrefix = '[CLIENT]';
    if (level === 'error') {
      console.error(`${logPrefix}`, message);
    } else if (level === 'warn') {
      console.warn(`${logPrefix}`, message);
    } else {
      console.log(`${logPrefix}`, message);
    }
    res.status(200).send('OK');
  } else {
    res.status(400).send('Missing message body');
  }
});

// Utility function to create and configure Imap connection
function createImapConnection(config) {
  // const isProduction = process.env.NODE_ENV === 'production'; // Temporarily ignore environment

  const imapConfig = {
    user: config.email,
    password: config.password,
    host: config.imapHost,
    port: config.imapPort,
    tls: Number(config.imapPort) === 993,
    connTimeout: 10000,
    authTimeout: 5000,
    tlsOptions: {
      servername: config.imapHost, // Add SNI hostname
      // rejectUnauthorized: false // REMOVE THIS LINE - Use default certificate verification
    }
    // debug: console.log
  };

  // Only disable certificate checks in non-production environments
  // if (!isProduction) { // Temporarily ignore environment
  //   imapConfig.tlsOptions = { rejectUnauthorized: false };
  //   console.log('[createImapConnection] Development environment detected, allowing self-signed certificates.');
  // }

  // Remove or comment out this warning as we are no longer forcing rejectUnauthorized: false
  // console.warn('[createImapConnection] WARNING: Allowing untrusted certificates (rejectUnauthorized: false) - FOR DEBUGGING ONLY.');

  return new Imap(imapConfig);
}

// Fetch emails endpoint using node-imap
app.post('/api/fetchEmails', (req, res) => {
  const {
    imapHost,
    imapPort,
    email,
    password,
    folder = 'INBOX',
    startDate,
    endDate,
    status = 'all',
    maxResults = 20
  } = req.body;

  if (!imapHost || !imapPort || !email || !password) {
    console.log('[API /api/fetchEmails] Missing connection details');
    return res.status(400).json({ error: 'Missing IMAP connection details' });
  }

  console.log(`[API /api/fetchEmails] Config: host=${imapHost}, port=${imapPort}, user=${email}, folder=${folder}`);

  const imap = createImapConnection({ imapHost, imapPort, email, password });

  function handleImapError(err, context = '') {
    console.error(`[API /api/fetchEmails] IMAP Error${context ? ' (' + context + ')' : ''}:`, err);
    try {
      imap.end();
    } catch (_) {}
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || `IMAP connection error${context ? ' during ' + context : ''}` });
    }
  }

  imap.once('error', (err) => handleImapError(err, 'general'));

  imap.once('ready', () => {
    console.log('[API /api/fetchEmails] IMAP connection ready.');
    imap.openBox(folder, false, (err, box) => { // false for read-write (needed? maybe not, but safer)
      if (err) return handleImapError(err, `opening mailbox ${folder}`);
      console.log(`[API /api/fetchEmails] Mailbox ${folder} opened. Total messages: ${box.messages.total}`);

      let searchCriteria = [];
      if (status === 'unread') searchCriteria.push('UNSEEN');
      else if (status === 'read') searchCriteria.push('SEEN');
      if (startDate) searchCriteria.push(['SINCE', new Date(`${startDate}T00:00:00.000Z`).toUTCString()]);
      if (endDate) {
        const endDateStartOfDayUTC = new Date(`${endDate}T00:00:00.000Z`);
        const beforeDate = new Date(endDateStartOfDayUTC.getTime() + 24 * 60 * 60 * 1000);
        searchCriteria.push(['BEFORE', beforeDate.toUTCString()]);
      }
      if (searchCriteria.length === 0) searchCriteria = ['ALL'];

      console.log(`[API /api/fetchEmails] Searching with criteria: ${JSON.stringify(searchCriteria)}`);

      imap.search(searchCriteria, (searchErr, uids) => {
        if (searchErr) return handleImapError(searchErr, 'searching mailbox');

        console.log(`[API /api/fetchEmails] Found ${uids.length} UIDs matching criteria.`);
        if (uids.length === 0) {
          imap.end();
          return res.json({ emails: [] });
        }

        const limitedUIDs = uids.slice(-maxResults);
        console.log(`[API /api/fetchEmails] Fetching details for ${limitedUIDs.length} UIDs (maxResults: ${maxResults}).`);

        const fetchPromises = [];
        const fetchedEmailsData = [];

        const fetch = imap.fetch(limitedUIDs, {
          bodies: '', // Fetch entire raw message source
          markSeen: false,
          struct: true, // Optional, but useful for mailparser
          fetchspec: 'X-GM-LABELS' // Explicitly request Gmail labels
        });

        fetch.on('message', (msg, seqno) => {
          console.log(`[API /api/fetchEmails] Receiving message #${seqno}`);
          let attributes = null;
          let msgSource = '';

          msg.on('body', (stream) => {
            stream.on('data', (chunk) => {
              msgSource += chunk.toString('utf8');
            });
          });

          msg.once('attributes', (attrs) => {
            attributes = attrs;
          });

          // Create a promise for parsing this specific message
          const parsePromise = new Promise((resolve) => {
            msg.once('end', async () => {
              const currentUid = attributes?.uid || 'N/A'; // Get UID for logging
              console.log(`[API /api/fetchEmails] Finished receiving message #${seqno} (UID: ${currentUid}). Attempting to parse...`);
              console.log('[API /api/fetchEmails] Attributes received:', attributes); // Log attributes to check for x-gm-labels

              if (!attributes) {
                console.warn(`[API /api/fetchEmails] No attributes found for message #${seqno}, skipping.`);
                resolve();
                return;
              }
              try {
                // Log just before parsing
                console.log(`[API /api/fetchEmails] Parsing UID: ${currentUid}`);
                const parsed = await simpleParser(msgSource);
                fetchedEmailsData.push({
                  id: attributes.uid,
                  sender: parsed.from?.text || '(no sender)',
                  subject: parsed.subject || '(no subject)',
                  date: attributes.date,
                  read: attributes.flags.includes('\\Seen'),
                  flags: attributes['x-gm-labels'] || [], // Use x-gm-labels for Gmail
                  body: parsed.text || (parsed.html ? '[HTML content only]' : '(no text body found)')
                });
                console.log(`[API /api/fetchEmails] Successfully parsed UID: ${currentUid}`);
                resolve();
              } catch (parseErr) {
                // Log the full error object
                console.error(`[API /api/fetchEmails] Error parsing message UID: ${currentUid}:`, JSON.stringify(parseErr, Object.getOwnPropertyNames(parseErr)));
                fetchedEmailsData.push({
                  id: attributes.uid,
                  sender: '(parse error)',
                  subject: '(parse error)',
                  date: attributes.date,
                  read: attributes.flags.includes('\\Seen'),
                  flags: attributes['x-gm-labels'] || [], // Use x-gm-labels for Gmail even on parse error
                  body: `(parse error: ${parseErr.message})` // Include error message in body
                });
                resolve(); // Still resolve
              }
            });
          });
          fetchPromises.push(parsePromise);
        });

        fetch.once('error', (fetchErr) => {
          console.error('[API /api/fetchEmails] Fetch stream error:', fetchErr);
        });

        fetch.once('end', async () => {
          console.log('[API /api/fetchEmails] Finished fetch stream. Waiting for all parsers...');
          try {
            await Promise.all(fetchPromises);
            console.log(`[API /api/fetchEmails] All parsers finished. Processed ${fetchedEmailsData.length} emails.`);
            imap.end();

            fetchedEmailsData.sort((a, b) => (b.date || 0) - (a.date || 0));
            if (!res.headersSent) {
                return res.json({ emails: fetchedEmailsData });
            }
          } catch (allPromisesError) {
             // Added explicit catch for Promise.all
             console.error('[API /api/fetchEmails] Error during Promise.all email processing:', allPromisesError);
             handleImapError(allPromisesError, 'processing fetched messages');
          }
        });
      });
    });
  });

  imap.connect();
});

// Test connection endpoint using node-imap
app.post('/api/testConnection', (req, res) => {
  console.log('[API /api/testConnection] Handler invoked.');
  const { imapHost, imapPort, email, password } = req.body;

  if (!imapHost || !imapPort || !email || !password) {
    console.log('[API /api/testConnection] Missing connection details');
    return res.status(400).json({ success: false, error: 'Missing required connection details' });
  }

  console.log(`[API /api/testConnection] Testing connection: host=${imapHost}, port=${imapPort}, user=${email}`);

  const imap = createImapConnection({ imapHost, imapPort, email, password });

  imap.once('ready', () => {
    console.log('[API /api/testConnection] Connection successful, ending connection.');
    imap.end();
    if (!res.headersSent) {
        return res.json({ success: true });
    }
  });

  imap.once('error', (err) => {
    console.error('[API /api/testConnection] Test connection failed:', err.message);
     try {
      imap.end(); // Ensure connection is closed on error
    } catch (_) {}
    if (!res.headersSent) {
        // Provide the specific error message back to the frontend
        return res.status(500).json({ success: false, error: err.message || 'Connection test failed' });
    }
  });

  imap.connect();
});

// Only run listen locally (when VERCEL env var is not set)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Local] Email API server listening on port ${PORT}`);
  }); 
}

export default app; // Export the app for Vercel 