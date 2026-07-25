// يجمع هذا السكربت كل ملفات data/posts/*.json (كل منشور في ملف مستقل،
// تديرها لوحة التحكم) في ملف واحد data/posts.json الذي يقرأه الموقع العام.
// يعمل تلقائيًا عبر GitHub Action عند أي تغيير في مجلد data/posts.

const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "data", "posts");
const OUT_PATH = path.join(__dirname, "data", "posts.json");

function main() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".json"));
  const posts = files.map((f) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf-8");
    return JSON.parse(raw);
  });

  posts.sort((a, b) => new Date(b.date_iso) - new Date(a.date_iso));

  fs.writeFileSync(OUT_PATH, JSON.stringify({ posts }, null, 1), "utf-8");
  console.log(`Aggregated ${posts.length} posts into data/posts.json`);
}

main();
