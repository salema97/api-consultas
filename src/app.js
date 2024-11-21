const express = require("express");
const cors = require("cors");
const path = require("path");
const ConsulteRoutes = require("./routes/consulte.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "static")));

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use("/api/consulte", ConsulteRoutes);

module.exports = app;
