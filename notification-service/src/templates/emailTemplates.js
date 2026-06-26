const url = () => process.env.FRONTEND_URL || "http://localhost:3000";

const documentUploadedTemplate = ({ title, ownerName, teamMemberEmails }) => ({
  subject: `New document uploaded: ${title}`,
  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<h2 style="color:#333;">New Document Uploaded</h2>
<p>A new document has been shared with your team.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Document</td>
<td style="padding:8px;border:1px solid #ddd;">${title}</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Uploaded by</td>
<td style="padding:8px;border:1px solid #ddd;">${ownerName || "A team member"}</td>
</tr>
</table>
<a href="${url()}" style="display:inline-block;padding:10px 20px;background:#4CAF50;color:white;text-decoration:none;border-radius:4px;">View in DMS</a>
</div>`,
});

const documentApprovedTemplate = ({ title, approvedBy }) => ({
  subject: `Document approved: ${title}`,
  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<h2 style="color:#4CAF50;">Document Approved ✓</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Document</td>
<td style="padding:8px;border:1px solid #ddd;">${title}</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Approved by</td>
<td style="padding:8px;border:1px solid #ddd;">${approvedBy || "A manager"}</td>
</tr>
</table>
<a href="${url()}" style="display:inline-block;padding:10px 20px;background:#4CAF50;color:white;text-decoration:none;border-radius:4px;">View Document</a>
</div>`,
});

const documentRejectedTemplate = ({ title, rejectedBy, reason }) => ({
  subject: `Document needs changes: ${title}`,
  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<h2 style="color:#e53935;">Document Needs Changes</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Document</td>
<td style="padding:8px;border:1px solid #ddd;">${title}</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Reviewed by</td>
<td style="padding:8px;border:1px solid #ddd;">${rejectedBy || "A manager"}</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Reason</td>
<td style="padding:8px;border:1px solid #ddd;color:#e53935;">${reason || "No reason provided"}</td>
</tr>
</table>
<a href="${url()}" style="display:inline-block;padding:10px 20px;background:#1976D2;color:white;text-decoration:none;border-radius:4px;">View Document</a>
</div>`,
});

const documentSubmittedTemplate = ({ title, ownerName, ownerEmail }) => ({
  subject: `Document awaiting approval: ${title}`,
  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<h2 style="color:#1976D2;">Document Pending Approval</h2>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Document</td>
<td style="padding:8px;border:1px solid #ddd;">${title}</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Submitted by</td>
<td style="padding:8px;border:1px solid #ddd;">${ownerName || ownerEmail}</td>
</tr>
</table>
<a href="${url()}" style="display:inline-block;padding:10px 20px;background:#1976D2;color:white;text-decoration:none;border-radius:4px;">Review Document</a>
</div>`,
});

// ── NEW: Offboarding notification ───────────────────────────
const documentsReassignedTemplate = ({ fromEmail, toEmail, count }) => ({
  subject: `${count} document(s) have been assigned to you`,
  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<h2 style="color:#333;">Documents Assigned to You</h2>
<p>As part of an organisational change, documents have been transferred to you.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Documents transferred</td>
<td style="padding:8px;border:1px solid #ddd;">${count}</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Previously owned by</td>
<td style="padding:8px;border:1px solid #ddd;">${fromEmail}</td>
</tr>
<tr>
<td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;">Now assigned to</td>
<td style="padding:8px;border:1px solid #ddd;">${toEmail}</td>
</tr>
</table>
<a href="${url()}" style="display:inline-block;padding:10px 20px;background:#333;color:white;text-decoration:none;border-radius:4px;">View Your Documents</a>
</div>`,
});

module.exports = {
  documentUploadedTemplate,
  documentApprovedTemplate,
  documentRejectedTemplate,
  documentSubmittedTemplate,
  documentsReassignedTemplate,
};
