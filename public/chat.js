/**
 * NOVA AI 🤖
 * Frontend chat + voice controls
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const micButton = document.getElementById("mic-button");

let chatHistory = [
	{
		role: "assistant",
		content:
			"Hello! Main Nova hoon 🤖 — Sachin ka banaya hua personal AI assistant. 😎🔥",
	},
];

let isProcessing = false;

/* -----------------------------
   TEXT INPUT
----------------------------- */

userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);


/* -----------------------------
   VOICE INPUT
----------------------------- */

const SpeechRecognition =
	window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

if (SpeechRecognition) {
	recognition = new SpeechRecognition();

	recognition.lang = "hi-IN";
	recognition.continuous = false;
	recognition.interimResults = false;

	recognition.onstart = function () {
		isListening = true;
		micButton.classList.add("listening");
		micButton.textContent = "⏹️";
	};

	recognition.onresult = function (event) {
		const transcript = event.results[0][0].transcript;

		userInput.value = transcript;
		userInput.dispatchEvent(new Event("input"));

		sendMessage();
	};

	recognition.onerror = function (event) {
		console.error("Voice recognition error:", event.error);
		stopListening();
	};

	recognition.onend = function () {
		stopListening();
	};

	micButton.addEventListener("click", function () {
		if (isListening) {
			recognition.stop();
		} else {
			try {
				recognition.start();
			} catch (error) {
				console.error("Could not start microphone:", error);
			}
		}
	});
} else {
	micButton.addEventListener("click", function () {
		alert("Is browser mein voice input supported nahi hai. Chrome mein try karo.");
	});
}

function stopListening() {
	isListening = false;
	micButton.classList.remove("listening");
	micButton.textContent = "🎤";
}


/* -----------------------------
   SEND MESSAGE
----------------------------- */

async function sendMessage() {
	const message = userInput.value.trim();

	if (message === "" || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;
	micButton.disabled = true;

	addMessageToChat("user", message);

	userInput.value = "";
	userInput.style.height = "auto";

	typingIndicator.classList.add("visible");

	chatHistory.push({
		role: "user",
		content: message,
	});

	try {
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = "<p></p>";

		chatMessages.appendChild(assistantMessageEl);

		const assistantTextEl =
			assistantMessageEl.querySelector("p");

		chatMessages.scrollTop = chatMessages.scrollHeight;

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
			}),
		});

		if (!response.ok) {
			throw new Error("Failed to get response");
		}

		if (!response.body) {
			throw new Error("Response body is null");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		let responseText = "";
		let buffer = "";
		let sawDone = false;

		const flushAssistantText = () => {
			assistantTextEl.textContent = responseText;
			chatMessages.scrollTop = chatMessages.scrollHeight;
		};

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				const parsed = consumeSseEvents(buffer + "\n\n");

				for (const data of parsed.events) {
					if (data === "[DONE]") break;

					try {
						const jsonData = JSON.parse(data);

						let content = "";

						if (typeof jsonData.response === "string") {
							content = jsonData.response;
						} else if (
							jsonData.choices?.[0]?.delta?.content
						) {
							content =
								jsonData.choices[0].delta.content;
						}

						if (content) {
							responseText += content;
							flushAssistantText();
						}
					} catch (error) {
						console.error(
							"Error parsing final SSE data:",
							error,
						);
					}
				}

				break;
			}

			buffer += decoder.decode(value, {
				stream: true,
			});

			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;

			for (const data of parsed.events) {
				if (data === "[DONE]") {
					sawDone = true;
					buffer = "";
					break;
				}

				try {
					const jsonData = JSON.parse(data);

					let content = "";

					if (typeof jsonData.response === "string") {
						content = jsonData.response;
					} else if (
						jsonData.choices?.[0]?.delta?.content
					) {
						content =
							jsonData.choices[0].delta.content;
					}

					if (content) {
						responseText += content;
						flushAssistantText();
					}
				} catch (error) {
					console.error(
						"Error parsing SSE data:",
						error,
					);
				}
			}

			if (sawDone) break;
		}

		if (responseText.length > 0) {
			chatHistory.push({
				role: "assistant",
				content: responseText,
			});

			/* Nova speaks the answer */
			speakNova(responseText);
		}
	} catch (error) {
		console.error("Error:", error);

		addMessageToChat(
			"assistant",
			"Sorry bro, abhi kuch problem aa gayi. 😅",
		);
	} finally {
		typingIndicator.classList.remove("visible");

		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		micButton.disabled = false;

		userInput.focus();
	}
}


/* -----------------------------
   NOVA VOICE OUTPUT
----------------------------- */

function speakNova(text) {
	if (!("speechSynthesis" in window)) {
		console.log("Speech synthesis supported nahi hai.");
		return;
	}

	window.speechSynthesis.cancel();

	const cleanText = text
		.replace(/[*_#`]/g, "")
		.replace(/\n+/g, " ")
		.trim();

	if (!cleanText) return;

	const voices = window.speechSynthesis.getVoices();

	const femaleHindiVoice =
		voices.find(
			voice =>
				/hi-IN/i.test(voice.lang) &&
				/(female|woman|girl|google hindi)/i.test(voice.name)
		) ||
		voices.find(
			voice => /hi-IN/i.test(voice.lang)
		);

	const femaleVoice =
		femaleHindiVoice ||
		voices.find(
			voice =>
				/(female|woman|girl)/i.test(voice.name)
		);

	const utterance = new SpeechSynthesisUtterance(cleanText);

	if (femaleVoice) {
		utterance.voice = femaleVoice;
	}

	utterance.lang = "hi-IN";
	utterance.rate = 0.95;
	utterance.pitch = 1.15;
	utterance.volume = 1;

	window.speechSynthesis.speak(utterance);
}

if ("speechSynthesis" in window) {
	window.speechSynthesis.onvoiceschanged = function () {
		window.speechSynthesis.getVoices();
	};
}

/* -----------------------------
   ADD MESSAGE
----------------------------- */

function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");

	messageEl.className =
		`message ${role}-message`;

	const paragraph = document.createElement("p");
	paragraph.textContent = content;

	messageEl.appendChild(paragraph);

	chatMessages.appendChild(messageEl);

	chatMessages.scrollTop =
		chatMessages.scrollHeight;
}


/* -----------------------------
   SSE PARSER
----------------------------- */

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");

	const events = [];
	let eventEndIndex;

	while (
		(eventEndIndex =
			normalized.indexOf("\n\n")) !== -1
	) {
		const rawEvent =
			normalized.slice(0, eventEndIndex);

		normalized =
			normalized.slice(eventEndIndex + 2);

		const lines = rawEvent.split("\n");
		const dataLines = [];

		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(
					line.slice("data:".length).trimStart(),
				);
			}
		}

		if (dataLines.length === 0) continue;

		events.push(dataLines.join("\n"));
	}

	return {
		events,
		buffer: normalized,
	};
}
