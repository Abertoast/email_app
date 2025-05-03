import express from 'express';
import cors from 'cors';
import Imap from 'imap'; // Use node-imap
import { simpleParser } from 'mailparser'; // Import mailparser
import util from 'util'; // Required for promisify
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

// Helper function to fetch and parse emails from a specific folder
async function fetchAndParseEmailsFromFolder(imap, folderName, searchCriteria, maxResultsPerFolder) {
  const openBoxAsync = util.promisify(imap.openBox).bind(imap);
  const searchAsync = util.promisify(imap.search).bind(imap);
  const fetchedEmailsData = [];

  try {
    console.log(`[fetchAndParseEmailsFromFolder] Opening box: ${folderName}`);
    const box = await openBoxAsync(folderName, true); // true for read-only
    console.log(`[fetchAndParseEmailsFromFolder] Mailbox ${folderName} opened. Total messages: ${box.messages.total}`);

    if (box.messages.total === 0) {
      console.log(`[fetchAndParseEmailsFromFolder] No messages in ${folderName}, skipping search.`);
      return []; // Return empty array if no messages
    }

    console.log(`[fetchAndParseEmailsFromFolder] Searching ${folderName} with criteria: ${JSON.stringify(searchCriteria)}`);
    const uids = await searchAsync(searchCriteria);

    console.log(`[fetchAndParseEmailsFromFolder] Found ${uids.length} UIDs in ${folderName}.`);
    if (uids.length === 0) {
      return []; // No matching messages
    }

    // Apply per-folder limit *before* fetching details
    const limitedUIDs = uids.slice(-maxResultsPerFolder);
    console.log(`[fetchAndParseEmailsFromFolder] Fetching details for ${limitedUIDs.length} UIDs from ${folderName} (maxResultsPerFolder: ${maxResultsPerFolder}).`);

    if (limitedUIDs.length === 0) {
        return []; // Should not happen if uids.length > 0, but safe check
    }

    return new Promise((resolve, reject) => {
      const fetchPromises = [];
      const fetch = imap.fetch(limitedUIDs, {
        bodies: '',
        markSeen: false,
        struct: true,
        // Ask for Gmail-specific attributes if available
        // node-imap will include x-gm-msgid and x-gm-labels in attributes if supported
        // See: https://github.com/mscdex/node-imap#fetchoptions
        // No need to specify fetchspec, just rely on node-imap's default behavior
      });

      fetch.on('message', (msg, seqno) => {
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

        const parsePromise = new Promise((resolveParse) => {
          msg.once('end', async () => {
            const currentUid = attributes?.uid || 'N/A';
            if (!attributes) {
              console.warn(`[fetchAndParseEmailsFromFolder] No attributes for message #${seqno} in ${folderName}, skipping.`);
              resolveParse();
              return;
            }
            try {
              // console.log(`[fetchAndParseEmailsFromFolder] Parsing UID: ${currentUid} from ${folderName}`); // Reduced logging verbosity
              const parsed = await simpleParser(msgSource);

              // ---> ADDED LOGGING HERE <---
              console.log(`[fetchAndParseEmailsFromFolder] [RAW ATTRS] UID: ${currentUid}, Folder: ${folderName}, Flags: ${JSON.stringify(attributes.flags)}, X-GM-Labels: ${JSON.stringify(attributes['x-gm-labels'])}`);

              fetchedEmailsData.push({
                id: attributes.uid,
                gmMsgId: attributes['x-gm-msgid'] || null,
                sender: parsed.from?.text || '(no sender)',
                subject: parsed.subject || '(no subject)',
                date: attributes.date,
                read: attributes.flags.includes('\\Seen'),
                flags: attributes['x-gm-labels'] || attributes.flags || [], // Fallback to flags if x-gm-labels not present
                body: parsed.text || (parsed.html ? '[HTML content only]' : '(no text body found)'),
                folder: folderName // Add folder information
              });
              // console.log(`[fetchAndParseEmailsFromFolder] Successfully parsed UID: ${currentUid} from ${folderName}`); // Reduced logging verbosity
              resolveParse();
            } catch (parseErr) {
              console.error(`[fetchAndParseEmailsFromFolder] Error parsing UID ${currentUid} in ${folderName}:`, parseErr.message);
              fetchedEmailsData.push({
                id: attributes.uid,
                gmMsgId: attributes['x-gm-msgid'] || null,
                sender: '(parse error)',
                subject: '(parse error)',
                date: attributes.date,
                read: attributes.flags.includes('\\Seen'),
                flags: attributes['x-gm-labels'] || attributes.flags || [],
                body: `(parse error: ${parseErr.message})`,
                folder: folderName // Add folder information even on error
              });
              resolveParse();
            }
          });
        });
        fetchPromises.push(parsePromise);
      });

      fetch.once('error', (fetchErr) => {
        console.error(`[fetchAndParseEmailsFromFolder] Fetch stream error in ${folderName}:`, fetchErr);
        reject(new Error(`Fetch stream error in ${folderName}: ${fetchErr.message}`)); // Reject the main promise
      });

      fetch.once('end', async () => {
        console.log(`[fetchAndParseEmailsFromFolder] Finished fetch stream for ${folderName}. Waiting for parsers...`);
        try {
          await Promise.all(fetchPromises);
          console.log(`[fetchAndParseEmailsFromFolder] Parsers finished for ${folderName}. Processed ${fetchedEmailsData.length} emails.`);
          // Don't close the box here, let the main function handle it or reuse connection
          resolve(fetchedEmailsData); // Resolve the main promise with the fetched data
        } catch (allPromisesError) {
          console.error(`[fetchAndParseEmailsFromFolder] Error during Promise.all for ${folderName}:`, allPromisesError);
          reject(allPromisesError); // Reject the main promise
        }
      });
    });
  } catch (err) {
      console.error(`[fetchAndParseEmailsFromFolder] Error processing folder ${folderName}:`, err);
      // Don't close box here either. Let the caller handle IMAP connection state.
      // Propagate the error so Promise.all catches it if needed, or return empty array to continue?
      // Returning empty allows fetching from other folders to continue.
      return []; // Return empty array on error to allow processing other folders
  }
}

// Fetch emails endpoint using node-imap
app.post('/api/fetchEmails', (req, res) => {
  const {
    imapHost,
    imapPort,
    email,
    password,
    folder = 'INBOX', // Default if fetchAllFolders is false
    fetchAllFolders = false, // New parameter
    startDate,
    endDate,
    status = 'all',
    maxResults = 20,
    subjectSearchTerm
  } = req.body;

  console.log(`[API /api/fetchEmails] Received subjectSearchTerm: '${subjectSearchTerm}'`);

  if (!imapHost || !imapPort || !email || !password) {
    console.log('[API /api/fetchEmails] Missing connection details');
    return res.status(400).json({ error: 'Missing IMAP connection details' });
  }

  console.log(`[API /api/fetchEmails] Config: host=${imapHost}, port=${imapPort}, user=${email}, fetchAllFolders=${fetchAllFolders}, targetFolder=${folder}`);

  const imap = createImapConnection({ imapHost, imapPort, email, password });
  let connectionEnded = false; // Flag to prevent multiple responses

  function handleImapError(err, context = '') {
    console.error(`[API /api/fetchEmails] IMAP Error${context ? ' (' + context + ')' : ''}:`, err);
    if (!connectionEnded) {
        connectionEnded = true;
        try {
          imap.end();
        } catch (_) {}
    }
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || `IMAP connection error${context ? ' during ' + context : ''}` });
    }
  }

  imap.once('error', (err) => handleImapError(err, 'general connection'));

  imap.once('ready', async () => {
    console.log('[API /api/fetchEmails] IMAP connection ready.');

    // --- Build Search Criteria ---
    let searchCriteria = [];
    if (status === 'unread') searchCriteria.push('UNSEEN');
    else if (status === 'read') searchCriteria.push('SEEN');
    if (startDate) searchCriteria.push(['SINCE', new Date(`${startDate}T00:00:00.000Z`).toUTCString()]);
    if (endDate) {
      const endDateStartOfDayUTC = new Date(`${endDate}T00:00:00.000Z`);
      const beforeDate = new Date(endDateStartOfDayUTC.getTime() + 24 * 60 * 60 * 1000);
      searchCriteria.push(['BEFORE', beforeDate.toUTCString()]);
    }
    if (subjectSearchTerm && subjectSearchTerm.trim() !== '') {
      searchCriteria.push(['SUBJECT', subjectSearchTerm.trim()]);
    }
    if (searchCriteria.length === 0) searchCriteria = ['ALL'];
    console.log(`[API /api/fetchEmails] Using search criteria: ${JSON.stringify(searchCriteria)}`);
    // --- End Build Search Criteria ---

    try {
        let allFetchedEmails = [];

        if (fetchAllFolders) {
            const getBoxesAsync = util.promisify(imap.getBoxes).bind(imap);
            console.log('[API /api/fetchEmails] Fetching all folders...');
            const boxes = await getBoxesAsync();
            const folderPromises = [];
            const folderNames = [];

            // Function to recursively get folder names
            function flattenFolders(boxHierarchy, prefix = '') {
                Object.keys(boxHierarchy).forEach(name => {
                    const currentPath = prefix ? `${prefix}${boxHierarchy[name].delimiter}${name}` : name;
                    // Add the folder itself if it's not marked as NoSelect (e.g., [Gmail] container)
                    if (!boxHierarchy[name].attribs.includes('\\Noselect')) {
                        folderNames.push(currentPath);
                    }
                    // Recurse if there are children
                    if (boxHierarchy[name].children && Object.keys(boxHierarchy[name].children).length > 0) {
                        flattenFolders(boxHierarchy[name].children, currentPath);
                    }
                });
            }

            flattenFolders(boxes);
            console.log(`[API /api/fetchEmails] Found folders: ${folderNames.join(', ')}`);

            // Heuristic: Fetch slightly more emails per folder than maxResults to improve chances
            // of getting the *actual* most recent across all folders, then limit at the end.
            // Adjust this multiplier as needed. If maxResults is small, fetch more.
            const perFolderLimit = Math.max(10, Math.ceil(maxResults * 1.5 / Math.max(1, folderNames.length)));
            console.log(`[API /api/fetchEmails] Fetching up to ${perFolderLimit} emails per folder.`);


            for (const folderName of folderNames) {
                // Avoid fetching from folders known not to contain user mail or causing issues
                 if (folderName.toUpperCase() === '[GMAIL]' || folderName.toUpperCase().includes('\\NOSELECT')) {
                     console.log(`[API /api/fetchEmails] Skipping folder: ${folderName}`);
                     continue;
                 }
                // We run promises sequentially to avoid overwhelming the server and reuse the connection state better
                // Although node-imap can handle parallel commands, sequential opening/closing of boxes is safer.
                try {
                    const emailsFromFolder = await fetchAndParseEmailsFromFolder(imap, folderName, searchCriteria, perFolderLimit);
                    allFetchedEmails.push(...emailsFromFolder);
                    console.log(`[API /api/fetchEmails] Fetched ${emailsFromFolder.length} emails from ${folderName}. Total so far: ${allFetchedEmails.length}`);
                } catch (folderError) {
                    console.error(`[API /api/fetchEmails] Error fetching from folder ${folderName}:`, folderError.message);
                    // Continue to the next folder even if one fails
                }
                 // Close the current box implicitly by opening the next one or explicitly if needed?
                 // node-imap handles closing the previous box when opening a new one.
            }
            console.log(`[API /api/fetchEmails] Finished fetching from all folders. Total emails collected: ${allFetchedEmails.length}`);

        } else {
            // Fetch from single specified folder
            console.log(`[API /api/fetchEmails] Fetching from single folder: ${folder}`);
             try {
                allFetchedEmails = await fetchAndParseEmailsFromFolder(imap, folder, searchCriteria, maxResults);
             } catch (folderError) {
                console.error(`[API /api/fetchEmails] Error fetching from single folder ${folder}:`, folderError.message);
                // If the single requested folder fails, we should probably error out
                return handleImapError(folderError, `fetching from folder ${folder}`);
            }
        }

        // --- Process Final Results ---
        console.log(`[API /api/fetchEmails] Sorting ${allFetchedEmails.length} total emails by date.`);
        allFetchedEmails.sort((a, b) => (b.date || 0) - (a.date || 0));

        const finalEmails = allFetchedEmails.slice(0, maxResults);
        console.log(`[API /api/fetchEmails] Returning final ${finalEmails.length} emails (maxResults: ${maxResults}).`);

        if (!connectionEnded) {
            connectionEnded = true;
            imap.end();
        }
        if (!res.headersSent) {
            res.json({ emails: finalEmails });
        }
        // --- End Process Final Results ---

    } catch (err) {
      handleImapError(err, 'processing folders/emails');
    }
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