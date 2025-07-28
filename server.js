const express = require("express");
const path = require("path");
const session = require("express-session");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

// 세션 설정 (메모리 스토어, 개발용)
// 실제 운영 환경에선 Redis 등 별도 스토어 권장
app.use(
  session({
    secret: "seat-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// 사용자 데이터 불러오기/저장
const USERS_FILE = path.join(__dirname, "users.json");
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();

// 기본 관리자 계정 자동 생성
if (!users["admin"]) {
  users["admin"] = { password: "admin123", role: "admin" };
  saveUsers(users);
}

// 루트 접속 시 로그인 페이지 전송
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 로그인 처리
app.post("/login", (req, res) => {
  const { id, pw } = req.body;
  const user = users[id];
  if (user && user.password === pw) {
    req.session.loggedIn = true;
    req.session.userId = id;
    req.session.role = user.role;
    res.redirect(user.role === "admin" ? "/admin.html" : "/index.html");
  } else {
    res.send("<script>alert('로그인 실패'); window.location='/';</script>");
  }
});

// 로그아웃 처리
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// 권한 체크 미들웨어
function requireTeacher(req, res, next) {
  if (req.session.loggedIn && req.session.role === "teacher") next();
  else res.redirect("/");
}
function requireAdmin(req, res, next) {
  if (req.session.loggedIn && req.session.role === "admin") next();
  else res.redirect("/");
}

// 권한 미들웨어를 정적 파일 서비스 전에 설정
app.use("/index.html", requireTeacher);
app.use("/admin.html", requireAdmin);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
