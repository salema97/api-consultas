const server = require("./src/app.js");
require("dotenv").config();

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto: ${PORT}`);
});
