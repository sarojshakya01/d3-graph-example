const express = require("express");
const cors = require("cors");
const app = express();

const fs = require("fs");
app.use(cors());

app.get("/getdata", (request, response) => {
  fs.readFile("./server/data.json", "utf8", function (err, contents) {
    response.send(contents);
  });
});

const port = 9000;

app.listen(port, () => {
  console.log("Server Running at localhost:" + port);
});
