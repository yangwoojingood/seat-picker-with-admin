const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const RedisStore = require("connect-redis")(session);
const redis = require("redis");

const app = express();
const PORT = process.env.PORT || 3000;

// Redis 클라이언트 생성 및 연결
const redisClient = redis.createClient({
  url: "redis://localhost:3000" // 실제 배포 환경에 맞게 수정 필요
});
redisClient.connect().catch(console.error);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// 세션 설정 (Redis 스토어 사용)
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: "seat-secret-key",
    resave: false,
    saveUninitialized: false, // 권장 설정
  })
);

// 사용자 파일 경로 및 함수
const USERS_FILE = path.join(__dirname, "users.json");
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();

// 기본 관리자 계정 (앱 시작 시 한 번만 저장되게 수정 권장)
if (!users["admin"]) {
  users["admin"] = { password: "admin123", role: "admin" };
  saveUsers(users);
}

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
    res.send("<script>alert('로그인 실패'); window.location='/login.html';</script>");
  }
});

// 관리자 권한 체크 미들웨어
function requireAdmin(req, res, next) {
  if (req.session.loggedIn && req.session.role === "admin") {
    next();
  } else {
    res.redirect("/login.html");
  }
}

// 선생님 권한 체크 미들웨어
function requireTeacher(req, res, next) {
  if (req.session.loggedIn && req.session.role === "teacher") {
    next();
  } else {
    res.redirect("/login.html");
  }
}

// 페이지 접근 제한
app.use("/index.html", requireTeacher);
app.use("/admin.html", requireAdmin);

// API: 계정 목록 (선생님만)
app.get("/api/users", requireAdmin, (req, res) => {
  const userList = Object.entries(users)
    .filter(([id, u]) => u.role === "teacher")
    .map(([id]) => ({ id }));
  res.json(userList);
});

// API: 계정 추가
app.post("/api/users/add", requireAdmin, (req, res) => {
  const { id, pw } = req.body;
  if (!id || !pw) return res.status(400).send("아이디/비밀번호 입력 필요");
  if (users[id]) return res.status(400).send("이미 존재하는 아이디입니다");
  users[id] = { password: pw, role: "teacher" };
  saveUsers(users);
  res.redirect("/admin.html");
});

// API: 계정 삭제
app.post("/api/users/delete", requireAdmin, (req, res) => {
  const { id } = req.body;
  if (id === "admin") return res.status(400).send("관리자 계정은 삭제할 수 없습니다");
  delete users[id];
  saveUsers(users);
  res.redirect("/admin.html");
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
