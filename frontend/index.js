const appEl = document.getElementById("app");

/**
 * The login page
 */
function goToLoginPage() {
  appEl.innerHTML = document.getElementById("loginPage").innerHTML;

  const memberIdEl = appEl.querySelector("#username");
  const channelsEl = appEl.querySelector("#channels");

  appEl.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    goToChatPage(
      memberIdEl.value,
      channelsEl.value.split(",").map((c) => c.trim())
    );
  });
}

/**
 * The chat page
 * @param {*} memberId
 * @param {*} channels
 */
async function goToChatPage(memberId, channels) {
  appEl.innerHTML = document.getElementById("chatPage").innerHTML;

  const channelsContainerEl = document.querySelector("#channelsContainer");
  const messageToSendEl = document.querySelector("#messageToSend");
  const dropdownContainerEl = document.querySelector(".dropdown ul");

  let isCurrentlyTyping = false;

  // Maps channel names to div containers
  const channelDiv = {};

  // Set of ids of the members who are typing
  const typingMemberIds = new Set();

  const reply = await axios.post("/get_chat_token", {
    member_id: memberId,
    channels: channels
  });

  const token = reply.data.token;
  console.log(token);

  const chatClient = new SignalWire.Chat.Client({
    token: token
  });
  window.chatClient = chatClient;
  console.log(channels);

  /**
   * Updates the UI to display the specified message into the specified channel.
   * @param {string} message
   * @param {string} channel
   */
  async function displayMessage(message, channel) {
    const messageListEl = channelDiv[channel].querySelector(".messages-list");
    const messageEl = document.createElement("div");
    messageEl.classList.add("message");
    messageEl.innerHTML = `
      <div class="message-meta"></div>
      <div class="message-body"></div>
    `;
    messageEl.querySelector(".message-meta").innerText = `${
      message.member.id
    } (${message.publishedAt.toLocaleString()})`;
    messageEl.querySelector(".message-body").innerText = message.content;
    messageListEl.append(messageEl);

    // Scroll to bottom
    messageEl.scrollIntoView(false);
  }

  /**
   * Download a list of existing messages from the server.
   * @param {string} channel
   */
  async function downloadExistingMessages(channel) {
    const messages = await chatClient.getMessages({
      channel: channel
    });

    if (!messages?.messages) return;

    for (const msg of messages.messages.reverse()) {
      displayMessage(msg, channel);
    }
  }

  /**
   * This function updates the state of the member to indicate
   * that she is not typing anymore.
   * Since it is debounced, it will only trigger if the user is not
   * typing for a while (1 second).
   */
  const typingTimeout = debounce(() => {
    chatClient.setMemberState({
      channels: channels,
      state: {
        typing: false
      }
    });
    isCurrentlyTyping = false;
  }, 1000);

  /**
   * This function is called each time the user presses a key in the text area.
   * It updates the state of the user to indicate that she is typing.
   */
  function userTyping() {
    if (!isCurrentlyTyping) {
      isCurrentlyTyping = true;
      chatClient.setMemberState({
        channels: channels,
        state: {
          typing: true
        }
      });
    }

    typingTimeout();
  }

  async function sendMessage(channel) {
    const message = messageToSendEl.value;

    await chatClient.publish({
      channel: channel,
      content: message
    });

    messageToSendEl.value = "";
  }

  // Initialize

  // Initialize the UI
  for (const channel of channels) {
    const channelEl = document.createElement("div");
    channelEl.classList.add("channel");
    channelEl.innerHTML = `
      <div class="channel-name"></div>
      <div class="messages-list"></div>
    `;
    channelEl.querySelector(".channel-name").innerText = channel;
    channelsContainerEl.append(channelEl);
    channelDiv[channel] = channelEl;

    const channelMenuEl = document.createElement("li");
    channelMenuEl.innerHTML = `<a class="dropdown-item" href="#"></a>`;
    channelMenuEl.querySelector("a").innerText = channel;
    channelMenuEl
      .querySelector("a")
      .addEventListener("click", () => sendMessage(channel));
    dropdownContainerEl.append(channelMenuEl);
  }

  // Handle the "member is typing..." indicator
  messageToSendEl.addEventListener("keyup", userTyping);

  // Download the already existing messages
  for (const channel of channels) {
    downloadExistingMessages(channel);
  }

  /**
   * Subscribe to the "message" event.
   * This is triggered each time a new message is sent in one of
   * the channels we're subscribed to.
   */
  chatClient.on("message", (message) => {
    displayMessage(message, message.channel);
  });

  /**
   * Subscribe to the "member.updated" event.
   * This is triggered each time the state of a member is updated.
   * We use this to update the "member is writing..." indicator by
   * checking the `member.state.typing` field.
   */
  chatClient.on("member.updated", (member) => {
    if (member.state?.typing) {
      typingMemberIds.add(member.id);
    } else {
      typingMemberIds.delete(member.id);
    }

    // Update the UI
    const typingEl = document.querySelector("#typing");
    const membersStr = Array.from(typingMemberIds).join(", ");
    if (typingMemberIds.size === 0) {
      typingEl.innerText = "";
    } else if (typingMemberIds.size === 1) {
      typingEl.innerText = membersStr + " is typing...";
    } else {
      typingEl.innerText = membersStr + " are typing...";
    }
  });

  // Subscribe to the channels to start receiving updates.
  chatClient.subscribe(channels);
}

goToLoginPage();
