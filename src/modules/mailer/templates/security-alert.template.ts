export function getSecurityAlertTemplate(params: {
  fullName: string;
  action: string;
  ipAddress: string;
  timestamp: Date;
}): { html: string; text: string } {
  const { fullName, action, ipAddress, timestamp } = params;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Peringatan Keamanan Akun - aegisAPI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { color: #f59e0b; font-size: 24px; margin: 0; }
    .content { line-height: 1.6; color: #cbd5e1; font-size: 15px; }
    .alert-box { background: #451a03; border: 1px solid #b45309; padding: 16px; border-radius: 8px; color: #fef3c7; margin: 20px 0; }
    .detail-item { margin: 8px 0; }
    .footer { border-top: 1px solid #334155; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Peringatan Keamanan Akun</h1>
    </div>
    <div class="content">
      <p>Halo <strong>${fullName}</strong>,</p>
      <p>Kami mendeteksi aktivitas keamanan penting yang baru saja terjadi pada akun Anda:</p>
      <div class="alert-box">
        <div class="detail-item"><strong>Aktivitas:</strong> ${action}</div>
        <div class="detail-item"><strong>Alamat IP:</strong> ${ipAddress}</div>
        <div class="detail-item"><strong>Waktu (WIB):</strong> ${timestamp.toISOString()}</div>
      </div>
      <p>Jika aktivitas ini dilakukan oleh Anda, Anda dapat mengabaikan email ini. Namun, jika Anda tidak merasa melakukan aktivitas ini, segera amankan akun Anda atau hubungi administrator.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 aegisAPI Security System.</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Halo ${fullName},

Peringatan Keamanan aegisAPI:
Aktivitas: ${action}
Alamat IP: ${ipAddress}
Waktu: ${timestamp.toISOString()}

Jika ini bukan Anda, segera amankan akun Anda.
--
aegisAPI Security System
`;

  return { html, text };
}
