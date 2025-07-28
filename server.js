const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const RedisStore = require("connect-redis")(session);
const redis = require("redis");

const app = express();
const PORT = process.env.PORT || 3000;

// Redis 클라이언트 생성
const redisClient = redis.createClient({
  url: "redis://localhost:3000" // 실제 배포 환경에 맞게 변경 필요
});
redisClient.connect().catch(console.error);

app.use(express.urlencoded({ extended: true }));

// 루트 경로 요청 먼저 처리
app.get("/", (req, res) => {
  console.log("GET / 요청 - 로그인 페이지로 리디렉션");
  res.redirect("/login.html");
});

// 세션 설정
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: "seat-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// 사용자 파일 함수
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

// 권한 체크 미들웨어
function requireAdmin(req, res, next) {
  if (req.session.loggedIn && req.session.role === "admin") next();
  else res.redirect("/login.html");
}

function requireTeacher(req, res, next) {
  if (req.session.loggedIn && req.session.role === "teacher") next();
  else res.redirect("/login.html");
}

// 권한 체크 미들웨어는 정적 파일 전에 위치
app.use("/index.html", requireTeacher);
app.use("/admin.html", requireAdmin);

// 정적 파일 서비스는 마지막에
app.use(express.static(path.join(__dirname, "public")));

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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
