const $ = 	LPkzORlVEP2AcERc("彩云");
const ERR =TCTBZ-4BXAQ-BU25T-2MRMK-IMCNS-6LFRB;

let display_location = $.read("display_location");
if (display_location === undefined) {
  display_location = false;
} else {
  display_location = JSON.parse(display_location);
}

if (typeof $request !== "undefined") {
  // 从请求 url 获取位置
  const url = $request.url;
  const res =
    url.match(/weather\/.*?\/(.*?)\/(.*?)\?/) ||
    url.match(/geocode\/([0-9.]+)\/([0-9.]+)\//) ||
    url.match(/geocode=([0-9.]+),([0-9.]+)/) ||
    url.match(/v2\/availability\/([0-9.]+)\/([0-9.]+)\//);
  if (res === null) {
    $.info(`❌ 正则表达式匹配错误，🥬 无法从 URL: ${url} 获取位置。`);
    $.done({ body: $request.body });
  }
  const location = {
    latitude: res[1],
    longitude: res[2],
  };
  if (!$.read("location")) {
    $.notify("[彩云天气]", "", "🎉🎉🎉 获取定位成功。");
  }
  if (display_location) {
    $.info(`成功获取当前位置：纬度 ${location.latitude} 经度 ${location.longitude}`);
  }

  $.write(res[1], "#latitude");
  $.write(res[2], "#longitude");

  $.write(location, "location");
  $.done({ body: $request.body });
} else {
  // 这是一个任务
  !(async () => {
    const { caiyun, tencent } = $.read("token") || {};

    if (!caiyun) {
      throw new ERR.TokenError("❌ 未找到彩云Token令牌");
    } else if (caiyun.indexOf("http") !== -1) {
      throw new ERR.TokenError("❌ Token令牌 并不是一个链接！");
    } else if (!tencent) {
      throw new ERR.TokenError("❌ 未找到腾讯地图Token");
    } else if (!$.read("location")) {
      // 没有位置
      $.notify(
        "[彩云天气]",
        "❌ 未找到位置",
        "🤖 您可能没有正确设置MITM，请检查重写是否成功。"
      );
    } else {
      await scheduler();
    }
  })()
    .catch((err) => {
      if (err instanceof ERR.TokenError)
        $.notify(
          "[彩云天气]",
          err.message,
          "🤖 由于API Token具有时效性，请前往\nhttps://t.me/cool_scripts\n获取最新Token。",
          {
            "open-url": "https://t.me/cool_scripts",
          }
        );
      else $.notify("[彩云天气]", "❌ 出现错误", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    })
    .finally(() => $.done());
}

async function scheduler() {
  const now = new Date();
  $.log(
    `调度程序于 ${now.getMonth() + 1}月${now.getDate()}日${now.getHours()}时${now.getMinutes()}分 激活`
  );
  await query();
  weatherAlert();
  realtimeWeather();
  // hourlyForecast();
  // dailyForecast();
}

async function query() {
  const location = $.read("location") || {};
  $.info(location);
  const isNumeric = (input) => input && !isNaN(input);
  if (!isNumeric(location.latitude) || !isNumeric(location.longitude)) {
    throw new Error("经纬度设置错误！");
  }

  if (Number(location.latitude) > 90 || Number(location.longitude) > 180) {
    throw new Error(
      "🤖 地理小课堂：经度的范围是0~180，纬度是0~90哦。请仔细检查经纬度是否设置正确。"
    );
  }
  // 查询 API
  const url = `https://api.caiyunapp.com/v2.5/${$.read("token").caiyun}/${$.read("location").longitude},${$.read("location").latitude}/weather?lang=zh_CN&dailystart=0&hourlysteps=384&dailysteps=16&alert=true`;

  $.log("查询天气...");

  const weather = await $.http.get({
    url,
    headers: {
      "User-Agent": "ColorfulCloudsPro/5.0.10 (iPhone; iOS 14.0; Scale/3.00)",
    },
  })
    .then((resp) => {
      const body = JSON.parse(resp.body);
      if (body.status === "failed") {
        throw new Error(body.error);
      }
      return body;
    })
    .catch((err) => {
      throw err;
    });
  $.weather = weather;

  const now = new Date().getTime();
  const addressUpdated = $.read("address_updated");
  let address = $.read("address");
  if (addressUpdated === undefined || now - addressUpdated > 30 * 60 * 1000) {
    await $.wait(Math.random() * 2000);
    $.log("查询位置...");
    address = await $.http.get(
      `https://apis.map.qq.com/ws/geocoder/v1/?key=${$.read("token").tencent}&location=${$.read("location").latitude},${$.read("location").longitude}`
    )
      .then((resp) => {
        const body = JSON.parse(resp.body);
        if (body.status !== 0) {
          throw new ERR.TokenError("❌ 腾讯地图Token错误");
        }
        return body.result.address_component;
      })
      .catch((err) => {
        throw err;
      });
    $.write(address, "address");
    $.write(now, "address_updated");
  }

  if (display_location == true) {
    $.info(JSON.stringify(address));
  }
  $.address = address;
}

function weatherAlert() {
  const data = $.weather.result.alert;
  const address = $.address;
  const alerted = $.read("alerted") || [];

  if (data.status === "ok") {
    data.content.forEach((alert) => {
      if (alerted.indexOf(alert.alertId) === -1) {
        $.notify(
          `[彩云天气] ${address.city} ${address.district} ${address.street}`,
          alert.title,
          alert.description
        );
        alerted.push(alert.alertId);
        if (alerted.length > 10) {
          alerted.shift();
        }
        $.write(alerted, "alerted");
      }
    });
  }
}

function realtimeWeather() {
  const data = $.weather.result;
  const address = $.address;

  const alert = data.alert;
  const alertInfo =
    alert.content.length == 0
      ? ""
      : alert.content.reduce((acc, curr) => {
          if (curr.status === "预警中") {
            return acc + "\n" + mapAlertCode(curr.code) + "预警";
          } else {
            return acc;
          }
        }, "[预警]") + "\n\n";

  const realtime = data.realtime;
  const keypoint = data.forecast_keypoint;

  const hourly = data.hourly;

  let hourlySkycon = "[未来3小时]\n";
  for (let i = 0; i < 3; i++) {
    const skycon = hourly.skycon[i];
    const dt = new Date(skycon.datetime);
    const now = dt.getHours() + 1;
    dt.setHours(dt.getHours() + 1);
    hourlySkycon +=
      `${now}-${dt.getHours() + 1}时 ${mapSkycon(skycon.value)[0]}` + (i == 2 ? "" : "\n");
  }

  $.notify(
    `[彩云天气] ${address.city} ${address.district} ${address.street}`,
    `${mapSkycon(realtime.skycon)[0]} ${realtime.temperature} ℃ 🌤 空气质量 ${realtime.air_quality.description.chn}`,
    `🔱${keypoint}
🌡 体感${realtime.life_index.comfort.desc} ${realtime.apparent_temperature} ℃ 💧 湿度${(realtime.humidity * 100).toFixed(0)}%
🌞 紫外线${realtime.life_index.ultraviolet.desc} 💨${mapWind(
      realtime.wind.speed,
      realtime.wind.direction
    )}

${alertInfo}${hourlySkycon}
`,
    {
      "media-url": `${mapSkycon(realtime.skycon)[1]}`,
    }
  );
}

function dailyForcast() { }

/**************************** 天气对照表 *********************************/

function mapAlertCode(code) {
  const names = {
    "01": "🌪 台风",
    "02": "⛈ 暴雨",
    "03": "❄️ 暴雪",
    "04": "❄ 寒潮",
    "05": "💨 大风",
    "06": "💨 沙尘暴",
    "07": "☄️ 高温",
    "08": "干旱",
    "09": "🌦 雷电",
    10: "冰雹",
    11: "霜冻",
    12: "🌫 大雾",
    13: "霾",
    14: "🚱 降水量不足",
    91: "雷电大风",
  };
  return names[code] || code;
}

function mapSkycon(code) {
  const names = {
    CLEAR_DAY: ["☀️ 晴天", "https://i.imgur.com/rMXv1o8.jpg"],
    CLEAR_NIGHT: ["🌕 晴夜", "https://i.imgur.com/W4WsfBk.jpg"],
    PARTLY_CLOUDY_DAY: ["🌤 多云", "https://i.imgur.com/wh3jFzG.jpg"],
    PARTLY_CLOUDY_NIGHT: ["⛅️ 多云", "https://i.imgur.com/Bh0tK93.jpg"],
    CLOUDY: ["☁️ 阴", "https://i.imgur.com/DLVryRA.jpg"],
    WIND: ["🌪 有风", "https://i.imgur.com/rMXv1o8.jpg"],
    HAZE: ["🌫 雾霾", "https://i.imgur.com/DLVryRA.jpg"],
    RAIN: ["🌧 雨", "https://i.imgur.com/c5UMetN.jpg"],
    SNOW: ["❄️ 雪", "https://i.imgur.com/Dw2yLOr.jpg"],
  };
  return names[code] || code;
}

function mapWind(speed, degree) {
  let res = "";
  if (speed < 1) res += "无风";
  else if (speed < 5) res += "微风";
  else if (speed < 11) res += "和风";
  else if (speed < 19) res += "清风";
  else if (speed < 28) res += "强风";
  else if (speed < 39) res += "疾风";
  else if (speed < 50) res += "大风";
  else if (speed < 62) res += "烈风";
  else if (speed < 75) res += "风暴";
  else if (speed < 89) res += "狂暴风";
  else res += "飓风";
  res += " ";
  res += degree <= 11
    ? "北风"
    : degree <= 34
    ? "东北风"
    : degree <= 56
    ? "东风"
    : degree <= 79
    ? "东南风"
    : degree <= 101
    ? "南风"
    : degree <= 124
    ? "西南风"
    : degree <= 146
    ? "西风"
    : degree <= 169
    ? "西北风"
    : "北风";
  return res;
}

/**************************** Helper functions *********************************/

function API(script = "彩云天气", name = "local", id = "DD3171") {
  const isRequest = typeof $request !== "undefined";
  const isSurge = typeof $httpClient !== "undefined";
  const isQuanX = typeof $task !== "undefined";
  const isLoon = typeof $loon !== "undefined";
  const read = (key) => {
    if (isSurge || isLoon) {
      return $persistentStore.read(key);
    }
    if (isQuanX) {
      return $prefs.valueForKey(key);
    }
  };
  const write = (value, key) => {
    if (isSurge || isLoon) {
      return $persistentStore.write(value, key);
    }
    if (isQuanX) {
      return $prefs.setValueForKey(value, key);
    }
  };
  const notify = (title, subtitle, message, options = {}) => {
    const openURL = options["open-url"];
    const mediaURL = options["media-url"];
    if (isSurge) {
      $notification.post(title, subtitle, message, {
        url: openURL,
        "media-url": mediaURL,
      });
    }
    if (isQuanX) {
      $notify(title, subtitle, message, options);
    }
    if (isLoon) {
      $notification.post(title, subtitle, message, openURL);
    }
  };
  const log = (message) => console.log(message);
  const info = (message) => console.log(message);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const done = (value = {}) => $done(value);
  return {
    read,
    write,
    notify,
    log,
    info,
    wait,
    done,
    isRequest,
    isSurge,
    isQuanX,
    isLoon,
  };
}

function MYERR() {
  class TokenError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
    }
  }

  return {
    TokenError,
  };
}
