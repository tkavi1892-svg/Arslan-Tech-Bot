const axios = require('axios');
const yts = require('yt-search');

const izumi = {
    baseURL: "https://izumiiiiiiii.dpdns.org"
};

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
    throw lastError;
}

async function getIzumiVideoByUrl(youtubeUrl) {
    const apiUrl = `${izumi.baseURL}/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}&format=720`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.download) return res.data.result;
    throw new Error('Izumi video api returned no download');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu ytmp4 returned no mp4');
}

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: '⚠️ Please type a video name or YouTube link.' }, { quoted: message });
            return;
        }

        let videoUrl = '';
        let videoInfo = {};

        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = searchQuery;
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: '❌ No videos found!' }, { quoted: message });
                return;
            }
            videoInfo = videos[0];
            videoUrl = videoInfo.url;
        }

        const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
        const thumb = videoInfo.thumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : undefined);
        const title = videoInfo.title || "YouTube Video";
        const views = videoInfo.views ? videoInfo.views.toLocaleString() : "N/A";
        const author = videoInfo.author?.name || "Unknown";
        const duration = videoInfo.timestamp || "Unknown";

        await sock.sendMessage(chatId, {
            image: { url: thumb },
            caption: `🎬 *${title}*\n\n╭═✦〔 *_VIDEO-DOWNLOADING_* 〕✦═╮\n* ⏱ Duration: *${duration}*\n* 👁 Views: *${views}*\n* 👤 Channel: *${author}*\n╰═✪═════════════✪═╯\n\n> 📥 Downloading your video...`
        }, { quoted: message });

        let videoData;
        try {
            videoData = await getIzumiVideoByUrl(videoUrl);
        } catch (e1) {
            videoData = await getOkatsuVideoByUrl(videoUrl);
        }

        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${videoData.title || title}.mp4`,
            caption: `🎬 *${videoData.title || title}*\n\n╭═✦〔 *_VIDEO-DOWNLOADED_* 〕✦═╮\n* ⏱ *Duration:* ${duration}\n* 👁 *Views:* ${views}\n* 👤 *Channel:* ${author}\n╰═✪═════════════✪═╯\n\n> ⚡ *Powered by ArslanMD Official*`
        }, { quoted: message });

    } catch (error) {
        console.error('[VIDEO CMD ERROR]', error?.message || error);
        await sock.sendMessage(chatId, { text: `❌ Download failed: ${error?.message || 'Unknown error'}` }, { quoted: message });
    }
}

module.exports = videoCommand;
