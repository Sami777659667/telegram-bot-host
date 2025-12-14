// netlify/functions/webhook.js
const fetch = require('node-fetch');

// هذه الدالة تجلب مسار الملف من تيليجرام ثم تحمل محتواه
async function getRulesFromTelegram(fileId, hostToken) {
    try {
        // 1. نحصل على مسار الملف
        const getFileUrl = `https://api.telegram.org/bot${hostToken}/getFile?file_id=${fileId}`;
        const fileRes = await fetch(getFileUrl);
        const fileData = await fileRes.json();
        
        if (!fileData.ok) return null;

        const filePath = fileData.result.file_path;
        
        // 2. نحمل المحتوى الفعلي (JSON)
        const downloadUrl = `https://api.telegram.org/file/bot${hostToken}/${filePath}`;
        const contentRes = await fetch(downloadUrl);
        const jsonRules = await contentRes.json();
        return jsonRules;
    } catch (e) {
        console.error("Error fetching rules:", e);
        return null;
    }
}

exports.handler = async (event, context) => {
    const params = event.queryStringParameters;
    const targetToken = params.target_token;
    const rulesFileId = params.fid; // معرف ملف القواعد
    const HOST_BOT_TOKEN = process.env.HOST_BOT_TOKEN; // نحتاجه لتحميل الملف

    if (!targetToken) return { statusCode: 400, body: 'No token' };

    let update;
    try { update = JSON.parse(event.body); } catch (e) { return { statusCode: 400 }; }
    if (!update.message || !update.message.text) return { statusCode: 200, body: 'OK' };

    const chatId = update.message.chat.id;
    const userMessage = update.message.text.toLowerCase();

    let replyText = "مرحباً! أنا أعمل."; // رد افتراضي

    // --- المنطق الذكي ---
    if (rulesFileId && HOST_BOT_TOKEN) {
        // تحميل القواعد ديناميكياً من سحابة تيليجرام
        const rules = await getRulesFromTelegram(rulesFileId, HOST_BOT_TOKEN);
        
        if (rules && rules.responses) {
            // البحث عن رد مناسب
            // الهيكلية المتوقعة: {"responses": [{"keyword": "hi", "reply": "hello"}]}
            const match = rules.responses.find(r => userMessage.includes(r.keyword.toLowerCase()));
            if (match) {
                replyText = match.reply;
            } else if (rules.default_reply) {
                replyText = rules.default_reply;
            }
        }
    } else {
        replyText = `Echo: ${update.message.text}`; // إذا لم يوجد ملف قواعد
    }

    // إرسال الرد
    await fetch(`https://api.telegram.org/bot${targetToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: replyText })
    });

    return { statusCode: 200, body: 'OK' };
};
