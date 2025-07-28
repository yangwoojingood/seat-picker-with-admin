const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "seat-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

const USERS_FILE = path.join(__dirname, "users.json");

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();

if (!users["admin"]) {
  users["admin"] = { password: "admin123", role: "admin" };
  saveUsers(users);
}

function requireAdmin(req, res, next) {
  if (req.session.loggedIn && req.session.role === "admin") next();
  else res.status(403).send("관리자 권한 필요");
}

// 라우트 먼저 선언
app.post("/api/users/add", requireAdmin, (req, res) => {
  const { id, pw } = req.body;
  if (!id || !pw) return res.status(400).send("아이디/비밀번호 입력 필요");
  if (users[id]) return res.status(400).send("이미 존재하는 아이디입니다");
  users[id] = { password: pw, role: "teacher" };
  saveUsers(users);
  res.redirect("/admin.html");
});

// 정적 파일 서비스는 라우트 선언 **뒤**에
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
