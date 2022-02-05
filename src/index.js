require("dotenv").config();
const auth = {
  username: process.env.PROJECT_ID, // Project-ID
  password: process.env.API_TOKEN, // API token
};
const apiurl = `https://${process.env.SPACE_URL}`;

const axios = require("axios")
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express()
const port = 8080

app.use(bodyParser.json());
app.use(cors());

app.use(express.static('frontend'))

app.post("/get_chat_token", async (req, res) => {
  const { member_id, channels } = req.body;

  const channelsPerms = {}
  for (const c of channels) {
    channelsPerms[c] = { read: true, write: true }
  }

  const reply = await axios.post(
    apiurl + "/api/chat/tokens",
    {
      ttl: 50,
      channels: channelsPerms,
      member_id,
      state: {},
    },
    { auth }
  )

  res.json({
    token: reply.data.token
  })
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})