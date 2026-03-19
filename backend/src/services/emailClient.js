'use strict';
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('../../db');

async function getCredentials(teamId) {
    if (!teamId) return null;
    try {
        const result = await db.query(
            `SELECT * FROM email_settings WHERE team_id = $1 AND is_active = TRUE`,
            [teamId]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.error('[Email] getCredentials error:', err.message);
        return null;
    }
}

async function sendEmail({ teamId, to, subject, bodyText, bodyHtml, replyTo, cc, fromName, inReplyTo, sentBy }) {
    const creds = await getCredentials(teamId);
    if (!creds) throw new Error('Email not configured for this team');

    const transporter = nodemailer.createTransport({
        host: creds.smtp_host,
        port: creds.smtp_port,
        secure: creds.smtp_secure,
        auth: { user: creds.smtp_user, pass: creds.smtp_pass },
        tls: { rejectUnauthorized: false }
    });

    const fromLabel = fromName || creds.display_name || creds.email_address;
    const mailOptions = {
        from: `"${fromLabel}" <${creds.email_address}>`,
        to,
        subject,
        text: bodyText,
        html: bodyHtml || undefined,
        cc: cc || undefined,
        replyTo: replyTo || undefined,
        inReplyTo: inReplyTo || undefined,
    };

    const info = await transporter.sendMail(mailOptions);

    // Determine thread_id from inReplyTo or generate from subject
    const threadId = inReplyTo || `thread-${subject}-${to}`;

    await db.query(
        `INSERT INTO email_messages
         (team_id, message_id, in_reply_to, thread_id, direction, subject, from_address, from_name,
          to_address, cc, body_text, body_html, status, is_read, sent_by, received_at)
         VALUES ($1,$2,$3,$4,'outbound',$5,$6,$7,$8,$9,$10,$11,'sent',TRUE,$12,NOW())`,
        [teamId, info.messageId, inReplyTo || null, threadId, subject,
         creds.email_address, fromLabel, to, cc || null, bodyText || null, bodyHtml || null, sentBy || null]
    );

    return { messageId: info.messageId, status: 'sent' };
}

async function fetchEmails(teamId, { limit = 20, mailbox = 'INBOX' } = {}) {
    const creds = await getCredentials(teamId);
    if (!creds) throw new Error('Email not configured for this team');

    const client = new ImapFlow({
        host: creds.imap_host,
        port: creds.imap_port,
        secure: creds.imap_secure,
        auth: {
            user: creds.imap_user || creds.email_address,
            pass: creds.imap_pass || creds.smtp_pass,
        },
        logger: false,
        tls: { rejectUnauthorized: false }
    });

    const fetched = [];
    try {
        await client.connect();
        const lock = await client.getMailboxLock(mailbox);
        try {
            const status = await client.status(mailbox, { messages: true });
            const total = status.messages;
            if (total === 0) return fetched;

            const start = Math.max(1, total - limit + 1);
            for await (const msg of client.fetch(`${start}:*`, { envelope: true, bodyStructure: true, uid: true })) {
                const raw = await client.fetchOne(msg.seq, { source: true });
                const parsed = await simpleParser(raw.source);

                const messageId = parsed.messageId;
                // Skip if already stored
                const exists = await db.query('SELECT id FROM email_messages WHERE team_id=$1 AND message_id=$2', [teamId, messageId]);
                if (exists.rowCount > 0) continue;

                const fromAddr = parsed.from?.value?.[0]?.address || '';
                const fromName = parsed.from?.value?.[0]?.name || '';
                const toAddr = parsed.to?.value?.[0]?.address || '';
                const toName = parsed.to?.value?.[0]?.name || '';
                const threadId = parsed.inReplyTo || messageId;

                await db.query(
                    `INSERT INTO email_messages
                     (team_id, message_id, in_reply_to, thread_id, direction, subject, from_address, from_name,
                      to_address, to_name, cc, body_text, body_html, status, is_read, received_at)
                     VALUES ($1,$2,$3,$4,'inbound',$5,$6,$7,$8,$9,$10,$11,$12,'received',FALSE,$13)
                     ON CONFLICT DO NOTHING`,
                    [teamId, messageId, parsed.inReplyTo || null, threadId,
                     parsed.subject || '(no subject)', fromAddr, fromName, toAddr, toName,
                     parsed.cc?.text || null, parsed.text || null, parsed.html || null,
                     parsed.date || new Date()]
                );
                fetched.push({ messageId, subject: parsed.subject, from: fromAddr });
            }
        } finally {
            lock.release();
        }
        await client.logout();

        // Update last_synced_at
        await db.query('UPDATE email_settings SET last_synced_at = NOW() WHERE team_id = $1', [teamId]);
    } catch (err) {
        console.error('[Email] fetchEmails error:', err.message);
        try { await client.logout(); } catch {}
        throw err;
    }
    return fetched;
}

async function getMessages(teamId, { limit = 30, offset = 0, direction, threadId, search } = {}) {
    const conditions = ['team_id = $1'];
    const values = [teamId];
    let idx = 2;

    if (direction) { conditions.push(`direction = $${idx++}`); values.push(direction); }
    if (threadId)  { conditions.push(`thread_id = $${idx++}`); values.push(threadId); }
    if (search) {
        conditions.push(`(subject ILIKE $${idx} OR from_address ILIKE $${idx} OR to_address ILIKE $${idx} OR body_text ILIKE $${idx})`);
        values.push(`%${search}%`); idx++;
    }

    values.push(limit, offset);
    const result = await db.query(
        `SELECT * FROM email_messages
         WHERE ${conditions.join(' AND ')}
         ORDER BY received_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        values
    );
    return result.rows;
}

async function markAsRead(id, teamId) {
    await db.query('UPDATE email_messages SET is_read = TRUE WHERE id = $1 AND team_id = $2', [id, teamId]);
}

async function deleteMessage(id, teamId) {
    await db.query('DELETE FROM email_messages WHERE id = $1 AND team_id = $2', [id, teamId]);
}

async function testConnection(creds) {
    // Test SMTP
    const transporter = nodemailer.createTransport({
        host: creds.smtp_host, port: creds.smtp_port, secure: creds.smtp_secure,
        auth: { user: creds.smtp_user, pass: creds.smtp_pass },
        tls: { rejectUnauthorized: false }
    });
    await transporter.verify();

    // Test IMAP
    const client = new ImapFlow({
        host: creds.imap_host, port: creds.imap_port, secure: creds.imap_secure,
        auth: { user: creds.imap_user || creds.smtp_user, pass: creds.imap_pass || creds.smtp_pass },
        logger: false, tls: { rejectUnauthorized: false }
    });
    await client.connect();
    await client.logout();
}

module.exports = { getCredentials, sendEmail, fetchEmails, getMessages, markAsRead, deleteMessage, testConnection };
