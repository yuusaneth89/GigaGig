const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

async function fetchPublicKey(url, apiKey) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });
  return response;
}

async function createWalletSetRequest(url, apiKey, ciphertext, uuid) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      idempotencyKey: uuid,
      name: "GigaGig Production Wallet Set",
      entitySecretCiphertext: ciphertext
    })
  });
  return response;
}

async function run() {
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("Error: Please make sure CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET are set in your .env file.");
    console.error("Run 'node scripts/generate_entity_secret.js' first.");
    process.exit(1);
  }

  const isSandbox = apiKey.startsWith("SAND_");
  const baseUrl = isSandbox ? "https://api-sandbox.circle.com" : "https://api.circle.com";
  
  console.log(`Targeting Environment: ${isSandbox ? "Sandbox" : "Production/Live"}`);
  console.log(`Base URL: ${baseUrl}`);

  // Fetch Public Key to encrypt fresh ciphertext
  console.log("Fetching fresh Entity Public Key from Circle...");
  let pubKeyResponse = null;
  try {
    pubKeyResponse = await fetchPublicKey(`${baseUrl}/v1/w3s/config/entity/publicKey`, apiKey);
  } catch (err) {
    console.error("Failed to fetch public key:", err.message);
    process.exit(1);
  }

  if (!pubKeyResponse || !pubKeyResponse.ok) {
    const errText = pubKeyResponse ? await pubKeyResponse.text() : "No response";
    console.error("Public key fetch returned error:", errText);
    process.exit(1);
  }

  const jsonPub = await pubKeyResponse.json();
  const publicKey = jsonPub.data.publicKey;

  console.log("Encrypting Entity Secret...");
  const entitySecretBuffer = Buffer.from(entitySecret, "hex");
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
      mgf1Hash: "sha256"
    },
    entitySecretBuffer
  );
  const ciphertext = encrypted.toString("base64");

  // Create Wallet Set
  console.log("Creating Wallet Set on Circle...");
  const uuid = crypto.randomUUID();
  let wsResponse = null;
  try {
    wsResponse = await createWalletSetRequest(`${baseUrl}/v1/w3s/developer/walletSets`, apiKey, ciphertext, uuid);
  } catch (err) {
    console.error("Wallet Set creation request failed:", err.message);
    process.exit(1);
  }

  if (!wsResponse || !wsResponse.ok) {
    const errText = wsResponse ? await wsResponse.text() : "No response";
    console.error("\nFailed to create Wallet Set! Error details:");
    console.error(errText);
    console.error("\nHave you registered your Entity Secret ciphertext in the Circle Console first?");
    console.error("Navigate to 'Developer' -> 'Config' in the Circle Console and register it using the ciphertext from scripts/generate_entity_secret.js.");
    process.exit(1);
  }

  try {
    const jsonWS = await wsResponse.json();
    const walletSetId = jsonWS.data.walletSet.id;
    console.log(`\nSuccessfully created Wallet Set!`);
    console.log(`Wallet Set ID: ${walletSetId}`);

    // Update .env file
    if (envContent.includes("CIRCLE_WALLET_SET_ID=")) {
      envContent = envContent.replace(/CIRCLE_WALLET_SET_ID=[^\r\n]*/, `CIRCLE_WALLET_SET_ID=${walletSetId}`);
    } else {
      envContent += `\nCIRCLE_WALLET_SET_ID=${walletSetId}`;
    }
    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("Successfully wrote CIRCLE_WALLET_SET_ID to your .env file!");

    console.log("\n======================================================================");
    console.log(`YOUR NEW WALLET SET ID: ${walletSetId}`);
    console.log("======================================================================\n");

  } catch (error) {
    console.error("Error parsing response:", error.message);
  }
}

run();
