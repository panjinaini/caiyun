const apiKey = 'JXAf4qpJvkvvV4ko'; // 替换为你的彩云天气 API 密钥

$loon.location({
  handler: (location) => {
    if (location) {
      const lat = location.lat;
      const lon = location.lon;
      const apiUrl = `https://api.caiyunapp.com/v2.5/${apiKey}/${lon},${lat}/realtime.json`;

      $httpClient.get(apiUrl, (error, response, data) => {
        if (error) {
          console.log('请求失败:', error);
        } else {
          const weatherData = JSON.parse(data);
          const result = {
            temperature: weatherData.result.temperature,
            humidity: weatherData.result.humidity,
            wind: weatherData.result.wind,
            air_quality: weatherData.result.air_quality,
            condition: weatherData.result.skycon,
            precipitation: weatherData.result.precipitation
          };
          
          const weatherIcons = {
            'CLEAR_DAY': '☀️',
            'CLEAR_NIGHT': '🌕',
            'PARTLY_CLOUDY_DAY': '⛅',
            'PARTLY_CLOUDY_NIGHT': '🌤',
            'CLOUDY': '☁️',
            'RAIN': '🌧',
            'SNOW': '❄️',
            'WIND': '🌬',
            'HAZE': '🌫'
          };

          const conditionIcon = weatherIcons[result.condition] || '';

          console.log('天气数据:', result);

          $notification.post(
            "实时天气", 
            `${conditionIcon} ${result.temperature}°C ${result.condition}`, 
            `湿度: ${result.humidity}%\n风速: ${result.wind.speed} m/s\n空气质量: ${result.air_quality.description}\n降水量: ${result.precipitation.local.intensity} mm/h`
          );
        }
        $done();
      });
    } else {
      console.log('无法获取位置信息');
      $done();
    }
  }
});