// يولّد هذا السكربت ملف rss.xml تلقائيًا من data/posts.json عند كل نشر على Netlify.
// يُستخدم هذا الملف لاحقًا مع أتمتة "RSS-to-Email" المجانية في Mailchimp
// لإرسال بريد تلقائي للمشتركين عند إضافة منشور جديد.

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://saidabuzeinah.netlify.app";
const DATA_PATH = path.join(__dirname, "data", "posts.json");
const OUT_PATH = path.join(__dirname, "rss.xml");

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  }[c]));
}

function main() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const posts = Array.isArray(raw) ? raw : (raw.posts || []);

  const sorted = posts.slice().sort(
    (a, b) => new Date(b.date_iso) - new Date(a.date_iso)
  );

  const items = sorted.slice(0, 30).map((post) => {
    const title = post.title || "خاطرة جديدة";
    const pubDate = new Date(post.date_iso).toUTCString();
    const bodySnippet = (post.body || "").slice(0, 500);
    const guid = `${SITE_URL}/#${post.date_iso}`;
    return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${SITE_URL}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${bodySnippet}]]></description>
    </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>أرشيف سعيد أبو زينة</title>
    <link>${SITE_URL}</link>
    <description>خواطر وقصص قصيرة من دفتر رقمي محفوظ بمرور الزمن</description>
    <language>ar</language>${items}
  </channel>
</rss>`;

  fs.writeFileSync(OUT_PATH, xml, "utf-8");
  console.log(`rss.xml generated with ${sorted.length > 30 ? 30 : sorted.length} items.`);
}

main();
