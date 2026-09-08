export function getPasswordResetTemplate(params: {
  fullName: string;
  resetLink: string;
  expiresInMinutes: number;
}): { html: string; text: string } {
  const { fullName, resetLink, expiresInMinutes } = params;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Kata Sandi - aegisAPI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { color: #38bdf8; font-size: 24px; margin: 0; }
    .content { line-height: 1.6; color: #cbd5e1; font-size: 15px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { background: #0284c7; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; }
    .token-box { background: #0f172a; border: 1px dashed #475569; padding: 12px; border-radius: 8px; font-family: monospace; word-break: break-all; color: #38bdf8; font-size: 14px; margin: 16px 0; }
    .footer { border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ aegisAPI Security</h1>
    </div>
    <div class="content">
      <p>Halo <strong>${fullName}</strong>,</p>
      <p>Kami menerima permintaan untuk mereset kata sandi akun Anda. Tautan pemulihan ini hanya berlaku selama <strong>${expiresInMinutes} menit</strong>.</p>
      <div class="btn-container">
        <a href="${resetLink}" class="btn" target="_blank">Reset Kata Sandi Saya</a>
      </div>
      <p>Jika tombol di atas tidak dapat diklik, gunakan tautan / token berikut secara manual:</p>
      <div class="token-box">${resetLink}</div>
      <p><strong>Penting:</strong> Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini. Akun Anda tetap aman dan kata sandi Anda tidak akan berubah tanpa tautan ini.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 aegisAPI Security System. Defense-in-Depth & Zero-Trust Architecture.</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Halo ${fullName},

Kami menerima permintaan untuk mereset kata sandi akun Anda di aegisAPI.
Tautan pemulihan Anda (berlaku ${expiresInMinutes} menit):

${resetLink}

Jika Anda tidak meminta reset kata sandi, abaikan pesan ini. Akun Anda tetap aman.
--
aegisAPI Security System
`;

  return { html, text };
}
