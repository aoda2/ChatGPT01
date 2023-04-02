const { conversation } = require('@assistant/conversation');
const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp();

const axios = require('axios');
const app = conversation();

const fs = require('fs');
const output = '/tmp/output.txt';
const history = '/tmp/history.json';

app.handle('get_message', async (conv) => {

  /* まず出力ファイルを削除 */
  try {
	  fs.unlinkSync(output);  
  } catch (error) {/* 初回もエラーになるので何もしない */}
  
  /* 非同期にChatGPT呼び出し*/
  asyncChat(conv);
  /* 先に返答を返す */
  conv.add("少々お待ち下さい");
});

/* 非同期にChatGPTを呼び出して、/tmp ファイルに書き込む */
async function asyncChat(conv) {
  /* クエリのテキストをそのまま利用 */
  const rawText = conv.intent.query;
  
  /* 以前の履歴がある場合、取り出し*/
  messages = [];
  try {
    const data = fs.readFileSync(history,{encoding:'utf8', flag:'r'});
  	console.log(data);
    messages = JSON.parse(data);
  } catch (error) {
    console.error(error);
  }
  messages.push({"role": "user", "content": rawText});
  
  /* ChatGPT 呼び出しパラメータ設定 */ 
  const url = 'https://api.openai.com/v1/chat/completions';  
  const params = {
     model: "gpt-3.5-turbo",
     messages: messages,
     temperature: 0.7
  };
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer API_KEY',
  };

  try {    
    const response = await axios.post(url, params, { headers });
    const aiText = response.data.choices[0].message.content;
		
    console.log("[_aiText]" + aiText);
    
    /* /tmp 領域のファイルに書き出し */
		fs.writeFileSync(output , aiText);
    
		/* 履歴が長くなりすぎないように削除 */
    if (messages.length > 4) {
      messages.splice(0, messages.length - 4);
    }
  	messages.push({"role": "assistant", "content": aiText});
    /* /tmp 領域のファイルに履歴を書き出し */
    fs.writeFileSync(history, JSON.stringify(messages));


  } catch (error) {
    console.error(error);
  }
}

app.handle('pop', async (conv) => {
  
  /* /tmp 領域からファイルを読み出し、エラーの場合はもうちょっとまってほしい旨を返す */
  try {
    const data = fs.readFileSync(output,{encoding:'utf8', flag:'r'});
  	console.log(data);
    conv.add(data);
  } catch (error) {
    console.error(error);
    conv.add("もうちょっとまってね");
  }
});


exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
