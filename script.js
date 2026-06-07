// ========================================
// API CONFIGURATION
// ========================================
const API_KEY = 'db504a599ace0dfd61035595b7df82de'; // يرجى استبدال هذا بمفتاح API الصحيح من OpenWeatherMap

// ========================================
// GLOBAL VARIABLES
// ========================================
let currentUnit = 'metric';
let currentLang = 'ar';
let currentCity = 'Cairo';
let currentLat = 30.0444;
let currentLon = 31.2357;
let weatherChart = null;
let humidityChart = null;
let windChart = null;
let trendChart = null;
let precipChart = null;
let weatherMap = null;
let favorites = [];
let compareCities = [];
let hourlySwiper = null;
let currentMapLayer = 'temp';
let notificationPermission = false;
let weatherCache = new Map();
let updateInterval = null;

// Current weather effects
let currentEffects = {
    type: 'day',
    weather: 'Clear',
    rainInterval: null,
    snowInterval: null,
    lightningInterval: null
};

// ========================================
// LOAD FAVORITES FROM STORAGE
// ========================================
try {
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
        favorites = JSON.parse(savedFavorites);
    }
    
    const savedCompare = localStorage.getItem('compareCities');
    if (savedCompare) {
        compareCities = JSON.parse(savedCompare);
    }
} catch (e) {
    console.error('Error loading saved data:', e);
    favorites = [];
    compareCities = [];
}

// ========================================
// CACHE MANAGEMENT
// ========================================
class WeatherCacheManager {
    constructor() {
        this.cache = new Map();
        this.expiryTime = 10 * 60 * 1000; // 10 minutes
    }
    
    set(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (item && (Date.now() - item.timestamp) < this.expiryTime) {
            return item.data;
        }
        return null;
    }
    
    clear() {
        this.cache.clear();
    }
    
    isExpired(key) {
        const item = this.cache.get(key);
        if (!item) return true;
        return (Date.now() - item.timestamp) >= this.expiryTime;
    }
}

const cacheManager = new WeatherCacheManager();

// ========================================
// UTILITIES FUNCTIONS
// ========================================

// Show loading overlay
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

// Show notification toast
function showNotificationToast(title, message, icon = 'fa-info-circle') {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas ${icon}" style="font-size: 24px; color: #ffd700;"></i>
            <div>
                <strong>${title}</strong>
                <p style="margin: 0; font-size: 14px;">${message}</p>
            </div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// Show error message
function showError(msg) {
    const errDiv = document.createElement('div');
    errDiv.className = 'error-toast';
    errDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
    document.body.appendChild(errDiv);
    setTimeout(() => errDiv.remove(), 4000);
}

// Show success message
function showSuccess(msg) {
    const successDiv = document.createElement('div');
    successDiv.className = 'error-toast';
    successDiv.style.background = 'rgba(80, 200, 80, 0.95)';
    successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

// Show API warning
function showApiWarning() {
    const warning = document.createElement('div');
    warning.className = 'api-warning';
    warning.innerHTML = `
        <strong><i class="fas fa-exclamation-triangle"></i> مفتاح API غير صحيح!</strong><br>
        يرجى التسجيل مجاناً في <a href="https://home.openweathermap.org/users/sign_up" target="_blank">OpenWeatherMap</a>
        ثم قم بتحديث المفتاح في المتغير API_KEY.<br>
        <small>🔑 بعد التسجيل، اذهب إلى قسم API Keys لنسخ المفتاح</small>
    `;
    document.body.appendChild(warning);
    setTimeout(() => warning.remove(), 10000);
}

// Get wind direction
function getWindDirection(deg) {
    const directions = ['شمال', 'شمال شرقي', 'شرق', 'جنوب شرقي', 'جنوب', 'جنوب غربي', 'غرب', 'شمال غربي'];
    return directions[Math.round(deg / 45) % 8];
}

// Get icon class
function getIconClass(weather) {
    const icons = {
        'Clear': 'fa-sun',
        'Clouds': 'fa-cloud',
        'Rain': 'fa-cloud-rain',
        'Drizzle': 'fa-cloud-rain',
        'Thunderstorm': 'fa-bolt',
        'Snow': 'fa-snowflake',
        'Mist': 'fa-smog',
        'Haze': 'fa-smog',
        'Fog': 'fa-smog'
    };
    return icons[weather] || 'fa-cloud';
}

// Get weather icon for display
function getWeatherIcon(weatherMain) {
    const iconMap = {
        'Clear': 'fa-sun',
        'Clouds': 'fa-cloud',
        'Rain': 'fa-cloud-rain',
        'Drizzle': 'fa-cloud-rain',
        'Thunderstorm': 'fa-bolt',
        'Snow': 'fa-snowflake',
        'Mist': 'fa-smog',
        'Haze': 'fa-smog',
        'Fog': 'fa-smog'
    };
    return iconMap[weatherMain] || 'fa-cloud-sun';
}

// Calculate UV index
function calculateUVIndex(lat, lon) {
    const date = new Date();
    const month = date.getMonth();
    const latAbs = Math.abs(lat);
    
    let uv = 0;
    if (latAbs < 23.5) {
        uv = 8 + Math.sin(month / 12 * Math.PI * 2) * 3;
    } else if (latAbs < 45) {
        uv = 5 + Math.cos(month / 12 * Math.PI * 2) * 2;
    } else {
        uv = 2 + Math.sin(month / 12 * Math.PI * 2) * 1.5;
    }
    
    uv = Math.max(0, Math.min(12, Math.round(uv * 10) / 10));
    return uv;
}

// Get UV level description
function getUVLevel(uvi) {
    if (uvi < 3) return 'منخفض';
    if (uvi < 6) return 'متوسط';
    if (uvi < 8) return 'مرتفع';
    if (uvi < 11) return 'مرتفع جدا';
    return 'خطير';
}

// Check if daytime
function isDaytime(sunrise, sunset) {
    const now = new Date();
    const sunriseTime = new Date(sunrise * 1000);
    const sunsetTime = new Date(sunset * 1000);
    return now > sunriseTime && now < sunsetTime;
}

// Fetch with retry
async function fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return await response.json();
            if (response.status === 401) {
                showApiWarning();
                return null;
            }
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return null;
}

// Format temperature
function formatTemp(temp) {
    const unit = currentUnit === 'metric' ? '°C' : '°F';
    return `${Math.round(temp)}${unit}`;
}

// ========================================
// WEATHER EFFECTS SYSTEM
// ========================================

function clearAllEffects() {
    const skyLayer = document.getElementById('skyLayer');
    if (skyLayer) {
        skyLayer.innerHTML = '';
    }
    if (currentEffects.rainInterval) clearInterval(currentEffects.rainInterval);
    if (currentEffects.snowInterval) clearInterval(currentEffects.snowInterval);
    if (currentEffects.lightningInterval) clearInterval(currentEffects.lightningInterval);
}

function createStars() {
    const skyLayer = document.getElementById('skyLayer');
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = 1 + Math.random() * 3;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 60 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = 1 + Math.random() * 2 + 's';
        skyLayer.appendChild(star);
    }
}

function createClouds(isDark = false, count = 6) {
    const skyLayer = document.getElementById('skyLayer');
    const cloudClass = isDark ? 'cloud-dark' : 'cloud-day';
    
    for (let i = 0; i < count; i++) {
        const cloud = document.createElement('div');
        cloud.className = cloudClass;
        const width = 150 + Math.random() * 250;
        const height = (width * 0.5) + Math.random() * 50;
        cloud.style.width = width + 'px';
        cloud.style.height = height + 'px';
        cloud.style.top = 5 + Math.random() * 30 + '%';
        cloud.style.animationDuration = 25 + Math.random() * 40 + 's';
        cloud.style.animationDelay = Math.random() * 15 + 's';
        cloud.style.opacity = isDark ? 0.4 + Math.random() * 0.3 : 0.5 + Math.random() * 0.4;
        cloud.style.setProperty('--y-offset', (Math.random() * 50 - 25) + 'px');
        skyLayer.appendChild(cloud);
    }
}

function createRain() {
    const skyLayer = document.getElementById('skyLayer');
    
    if (currentEffects.rainInterval) clearInterval(currentEffects.rainInterval);
    
    function addRaindrop() {
        const raindrop = document.createElement('div');
        raindrop.className = 'raindrop';
        raindrop.style.left = Math.random() * 100 + '%';
        raindrop.style.animationDuration = 0.6 + Math.random() * 0.5 + 's';
        raindrop.style.animationDelay = Math.random() * 0.5 + 's';
        skyLayer.appendChild(raindrop);
        setTimeout(() => raindrop.remove(), 1100);
    }
    
    for (let i = 0; i < 80; i++) {
        setTimeout(() => addRaindrop(), i * 30);
    }
    
    currentEffects.rainInterval = setInterval(() => {
        for (let i = 0; i < 15; i++) {
            addRaindrop();
        }
    }, 200);
}

function createSnow() {
    const skyLayer = document.getElementById('skyLayer');
    
    if (currentEffects.snowInterval) clearInterval(currentEffects.snowInterval);
    
    function addSnowflake() {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        const size = 3 + Math.random() * 6;
        snowflake.style.width = size + 'px';
        snowflake.style.height = size + 'px';
        snowflake.style.left = Math.random() * 100 + '%';
        snowflake.style.animationDuration = 3 + Math.random() * 4 + 's';
        snowflake.style.animationDelay = Math.random() * 2 + 's';
        skyLayer.appendChild(snowflake);
        setTimeout(() => snowflake.remove(), 7000);
    }
    
    for (let i = 0; i < 60; i++) {
        setTimeout(() => addSnowflake(), i * 100);
    }
    
    currentEffects.snowInterval = setInterval(() => {
        for (let i = 0; i < 8; i++) {
            addSnowflake();
        }
    }, 300);
}

function createLightning() {
    const skyLayer = document.getElementById('skyLayer');
    
    if (currentEffects.lightningInterval) clearInterval(currentEffects.lightningInterval);
    
    function addLightning() {
        const lightning = document.createElement('div');
        lightning.className = 'lightning';
        lightning.style.left = (30 + Math.random() * 40) + '%';
        lightning.style.top = '0%';
        lightning.style.animation = 'lightningFlash 0.5s ease-out';
        lightning.style.opacity = '1';
        skyLayer.appendChild(lightning);
        
        // Flash effect
        document.body.style.backgroundColor = 'rgba(255, 255, 200, 0.3)';
        setTimeout(() => {
            document.body.style.backgroundColor = '';
        }, 100);
        
        setTimeout(() => lightning.remove(), 600);
    }
    
    currentEffects.lightningInterval = setInterval(() => {
        if (Math.random() > 0.7) {
            addLightning();
        }
    }, 3000);
}

function createWinds() {
    const skyLayer = document.getElementById('skyLayer');
    
    for (let i = 0; i < 12; i++) {
        const wind = document.createElement('div');
        wind.className = 'wind-line';
        wind.style.top = Math.random() * 100 + '%';
        wind.style.animationDuration = 4 + Math.random() * 8 + 's';
        wind.style.animationDelay = Math.random() * 6 + 's';
        wind.style.width = 50 + Math.random() * 150 + 'px';
        skyLayer.appendChild(wind);
    }
}

function createFog() {
    const skyLayer = document.getElementById('skyLayer');
    const fog = document.createElement('div');
    fog.className = 'fog';
    skyLayer.appendChild(fog);
}

function updateWeatherEffects(weatherMain, isDaytime) {
    clearAllEffects();
    
    const skyLayer = document.getElementById('skyLayer');
    
    if (isDaytime) {
        const sun = document.createElement('div');
        sun.className = 'sun';
        skyLayer.appendChild(sun);
        
        const sunRays = document.createElement('div');
        sunRays.className = 'sun-rays';
        skyLayer.appendChild(sunRays);
        
        switch(weatherMain) {
            case 'Clear':
                createClouds(false, 3);
                break;
            case 'Clouds':
                createClouds(false, 8);
                break;
            case 'Rain':
            case 'Drizzle':
                createClouds(true, 6);
                createRain();
                createWinds();
                break;
            case 'Thunderstorm':
                createClouds(true, 8);
                createRain();
                createLightning();
                createWinds();
                break;
            case 'Snow':
                createClouds(true, 5);
                createSnow();
                break;
            case 'Mist':
            case 'Haze':
            case 'Fog':
                createClouds(true, 4);
                createFog();
                break;
            default:
                createClouds(false, 4);
        }
    } else {
        const moon = document.createElement('div');
        moon.className = 'moon';
        skyLayer.appendChild(moon);
        createStars();
        
        switch(weatherMain) {
            case 'Clear':
                createClouds(false, 2);
                break;
            case 'Clouds':
                createClouds(false, 6);
                break;
            case 'Rain':
            case 'Drizzle':
                createClouds(true, 5);
                createRain();
                break;
            case 'Thunderstorm':
                createClouds(true, 7);
                createRain();
                createLightning();
                break;
            case 'Snow':
                createClouds(true, 4);
                createSnow();
                break;
            case 'Mist':
            case 'Haze':
                createFog();
                break;
            default:
                createClouds(false, 3);
        }
    }
    
    if (weatherMain !== 'Thunderstorm' && weatherMain !== 'Rain') {
        createWinds();
    }
}

// ========================================
// API CALLS
// ========================================

async function fetchWeather(city) {
    if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
        showApiWarning();
        return null;
    }
    
    const cacheKey = `weather_${city}_${currentUnit}_${currentLang}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) return cachedData;
    
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${currentUnit}&lang=${currentLang === 'ar' ? 'ar' : 'en'}`;
        const data = await fetchWithRetry(url);
        if (data) cacheManager.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Weather fetch error:', error);
        showError(error.message || 'فشل في جلب بيانات الطقس');
        return null;
    }
}

async function fetchForecast(lat, lon) {
    if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') return null;
    
    const cacheKey = `forecast_${lat}_${lon}_${currentUnit}_${currentLang}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) return cachedData;
    
    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}&lang=${currentLang === 'ar' ? 'ar' : 'en'}`;
        const data = await fetchWithRetry(url);
        if (data) cacheManager.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Forecast fetch error:', error);
        return null;
    }
}

async function fetchAirQuality(lat, lon) {
    if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') return null;
    
    const cacheKey = `aqi_${lat}_${lon}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) return cachedData;
    
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        if (!response.ok) throw new Error('AQI error');
        const data = await response.json();
        cacheManager.set(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Air quality fetch error:', error);
        return null;
    }
}

// ========================================
// UI UPDATE FUNCTIONS
// ========================================

function updateCurrentWeather(data) {
    if (!data) return;
    
    document.getElementById('cityName').textContent = data.name;
    document.getElementById('temperature').textContent = Math.round(data.main.temp);
    document.getElementById('condition').textContent = data.weather[0].description || data.weather[0].main;
    document.getElementById('feelsLike').innerHTML = `<i class="fas fa-thermometer-half"></i> يشعر ب ${Math.round(data.main.feels_like)}°C`;
    document.getElementById('humidity').textContent = data.main.humidity;
    document.getElementById('humidityQuick').textContent = `${data.main.humidity}%`;
    document.getElementById('pressure').textContent = data.main.pressure;
    document.getElementById('pressureQuick').textContent = `${data.main.pressure} hPa`;
    document.getElementById('windSpeed').textContent = Math.round(data.wind.speed);
    
    // Min/Max temp
    if (data.main.temp_min && data.main.temp_max) {
        document.getElementById('minTemp').textContent = `${Math.round(data.main.temp_min)}°`;
        document.getElementById('maxTemp').textContent = `${Math.round(data.main.temp_max)}°`;
    }
    
    // Visibility
    if (data.visibility) {
        const visibilityKm = (data.visibility / 1000).toFixed(1);
        document.getElementById('visibility').textContent = visibilityKm;
    }
    
    // Clouds
    if (data.clouds && data.clouds.all) {
        document.getElementById('clouds').textContent = `${data.clouds.all}%`;
    }
    
    const windDeg = data.wind.deg;
    document.getElementById('windDir').textContent = getWindDirection(windDeg);
    document.getElementById('windDirectionText').textContent = `الاتجاه: ${getWindDirection(windDeg)} (${windDeg}°)`;
    document.getElementById('windSpeedDetail').textContent = Math.round(data.wind.speed);
    
    const needle = document.getElementById('windNeedle');
    needle.style.transform = `translateX(-50%) rotate(${windDeg}deg)`;
    
    const rainChance = data.rain ? Math.round(data.rain['3h'] || 0) : Math.round(Math.random() * 30);
    document.getElementById('rainChance').innerHTML = `<i class="fas fa-cloud-rain"></i> فرصة هطول: ${rainChance}%`;
    
    const sunrise = new Date(data.sys.sunrise * 1000);
    const sunset = new Date(data.sys.sunset * 1000);
    document.getElementById('sunrise').textContent = sunrise.toLocaleTimeString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('sunset').textContent = sunset.toLocaleTimeString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    
    const now = new Date();
    document.getElementById('dateTime').textContent = now.toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const weatherMain = data.weather[0].main;
    document.getElementById('weatherIcon').className = `fas ${getWeatherIcon(weatherMain)}`;
    
    // Weather tags
    const tagsContainer = document.getElementById('weatherTags');
    tagsContainer.innerHTML = '';
    const tags = [
        { icon: 'fa-temperature-low', text: `${Math.round(data.main.temp_min)}° / ${Math.round(data.main.temp_max)}°` },
        { icon: 'fa-wind', text: `${Math.round(data.wind.speed)} كم/س` },
        { icon: 'fa-tint', text: `${data.main.humidity}%` }
    ];
    tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.innerHTML = `<i class="fas ${tag.icon}"></i> ${tag.text}`;
        tagsContainer.appendChild(tagSpan);
    });
    
    const daytime = isDaytime(data.sys.sunrise, data.sys.sunset);
    updateWeatherEffects(weatherMain, daytime);
    
    if (daytime) {
        document.body.style.background = 'linear-gradient(160deg, #0f2027, #203a43, #2c5364)';
    } else {
        document.body.style.background = 'linear-gradient(160deg, #0a0e2a, #151b3a, #1a1f4a)';
    }
}

function displayHourlyForecast(data) {
    const container = document.getElementById('hourlyContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!data || !data.list) return;
    
    const next24 = data.list.slice(0, 24);
    for (const item of next24) {
        const time = new Date(item.dt * 1000);
        const hour = time.getHours();
        const div = document.createElement('div');
        div.className = 'swiper-slide hourly-card';
        div.innerHTML = `
            <div style="font-size: 18px; font-weight: bold;">${hour}:00</div>
            <i class="fas ${getIconClass(item.weather[0].main)}" style="font-size: 28px; margin: 10px 0;"></i>
            <div style="font-size: 22px; font-weight: bold;">${Math.round(item.main.temp)}°</div>
            <div style="font-size: 12px;">💧 ${item.main.humidity}%</div>
            <div style="font-size: 11px;">🌧️ ${Math.round(item.pop * 100)}%</div>
        `;
        container.appendChild(div);
    }
    
    // Initialize Swiper
    if (hourlySwiper) hourlySwiper.destroy();
    hourlySwiper = new Swiper('.hourly-swiper', {
        slidesPerView: 'auto',
        spaceBetween: 15,
        freeMode: true,
        navigation: {
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
        },
        breakpoints: {
            0: { slidesPerView: 2 },
            480: { slidesPerView: 3 },
            768: { slidesPerView: 4 },
            1024: { slidesPerView: 6 }
        }
    });
}

function displayDailyForecast(data) {
    const container = document.getElementById('dailyContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!data || !data.list) return;
    
    const dailyMap = new Map();
    for (const item of data.list) {
        const date = new Date(item.dt * 1000).toLocaleDateString();
        if (!dailyMap.has(date)) dailyMap.set(date, []);
        dailyMap.get(date).push(item);
    }
    
    let count = 0;
    for (const [date, items] of dailyMap) {
        if (count >= 7) break;
        const minTemp = Math.round(Math.min(...items.map(i => i.main.temp_min)));
        const maxTemp = Math.round(Math.max(...items.map(i => i.main.temp_max)));
        const weather = items[0].weather[0];
        const avgPop = items.reduce((s, i) => s + (i.pop || 0), 0) / items.length;
        
        const div = document.createElement('div');
        div.className = 'daily-item';
        div.innerHTML = `
            <div style="min-width: 100px;">
                <strong>${new Date(date).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long' })}</strong>
                <br><small>${date}</small>
            </div>
            <i class="fas ${getIconClass(weather.main)}" style="font-size: 28px;"></i>
            <div><span style="color: #ff9999;">${maxTemp}°</span> / <span style="color: #99ccff;">${minTemp}°</span></div>
            <div style="font-size: 14px;">${weather.description || weather.main}</div>
            <div style="font-size: 12px;">🌧️ ${Math.round(avgPop * 100)}%</div>
        `;
        container.appendChild(div);
        count++;
    }
}

function drawCharts(forecastData) {
    if (!forecastData || !forecastData.list) return;
    
    const dailyMap = new Map();
    for (const item of forecastData.list) {
        const date = new Date(item.dt * 1000).toLocaleDateString();
        if (!dailyMap.has(date)) dailyMap.set(date, []);
        dailyMap.get(date).push(item);
    }
    
    const labels = [];
    const temps = [];
    const humidities = [];
    const windSpeeds = [];
    const pops = [];
    
    let count = 0;
    for (const [date, items] of dailyMap) {
        if (count >= 7) break;
        const avgTemp = items.reduce((s, i) => s + i.main.temp, 0) / items.length;
        const avgHumidity = items.reduce((s, i) => s + i.main.humidity, 0) / items.length;
        const avgWind = items.reduce((s, i) => s + i.wind.speed, 0) / items.length;
        const avgPop = items.reduce((s, i) => s + (i.pop || 0), 0) / items.length;
        
        labels.push(new Date(date).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }));
        temps.push(Math.round(avgTemp));
        humidities.push(Math.round(avgHumidity));
        windSpeeds.push(Math.round(avgWind));
        pops.push(Math.round(avgPop * 100));
        count++;
    }
    
    // Temperature Chart
    if (weatherChart) weatherChart.destroy();
    const tempCtx = document.getElementById('tempChart').getContext('2d');
    weatherChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'درجة الحرارة (°C)',
                data: temps,
                borderColor: 'rgba(255, 215, 0, 0.8)',
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(255, 215, 0, 1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: 'white' } } },
            scales: { y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                      x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } }
        }
    });
    
    // Humidity Chart
    if (humidityChart) humidityChart.destroy();
    const humidityCtx = document.getElementById('humidityChart').getContext('2d');
    humidityChart = new Chart(humidityCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'الرطوبة (%)',
                data: humidities,
                backgroundColor: 'rgba(100, 181, 246, 0.6)',
                borderColor: 'rgba(100, 181, 246, 1)',
                borderWidth: 2,
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: 'white' } } },
            scales: { y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' }, max: 100 },
                      x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } }
        }
    });
    
    // Wind Chart
    if (windChart) windChart.destroy();
    const windCtx = document.getElementById('windChart').getContext('2d');
    windChart = new Chart(windCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'سرعة الرياح (كم/س)',
                data: windSpeeds,
                borderColor: 'rgba(129, 199, 132, 0.8)',
                backgroundColor: 'rgba(129, 199, 132, 0.1)',
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: 'rgba(129, 199, 132, 1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: 'white' } } },
            scales: { y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                      x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } }
        }
    });
    
    // Trend Chart (for analytics)
    if (trendChart) trendChart.destroy();
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'الحرارة (°C)', data: temps, borderColor: '#ffd700', borderWidth: 2, fill: false, tension: 0.4 },
                { label: 'الرطوبة (%)', data: humidities, borderColor: '#64b5f6', borderWidth: 2, fill: false, tension: 0.4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: 'white' } } },
            scales: { y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                      x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } }
        }
    });
    
    // Precipitation Chart
    if (precipChart) precipChart.destroy();
    const precipCtx = document.getElementById('precipChart').getContext('2d');
    precipChart = new Chart(precipCtx, {
        type: 'doughnut',
        data: {
            labels: ['أمطار', 'بدون أمطار'],
            datasets: [{
                data: [pops.reduce((a, b) => a + b, 0) / pops.length, 100 - (pops.reduce((a, b) => a + b, 0) / pops.length)],
                backgroundColor: ['#42a5f5', 'rgba(255,255,255,0.2)'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: 'white' } } }
        }
    });
}

async function updateExtraData(lat, lon) {
    const aqiData = await fetchAirQuality(lat, lon);
    if (aqiData && aqiData.list && aqiData.list[0]) {
        const aqi = aqiData.list[0].main.aqi;
        const aqiText = ['ممتاز', 'جيد', 'متوسط', 'سيء', 'خطير'][aqi - 1];
        document.getElementById('aqi').innerHTML = `${aqiText}<span style="font-size:12px; display:block;">AQI ${aqi}</span>`;
    } else {
        document.getElementById('aqi').innerHTML = 'غير متوفر';
    }
    
    const uvIndex = calculateUVIndex(lat, lon);
    document.getElementById('uvIndex').innerHTML = `${uvIndex}<span style="font-size:12px; display:block;">${getUVLevel(uvIndex)}</span>`;
}

// Generate weather tips
function generateWeatherTips(weatherMain, temp, humidity, windSpeed) {
    const tips = [];
    
    if (weatherMain === 'Rain' || weatherMain === 'Drizzle') {
        tips.push({ icon: 'fa-umbrella', text: 'لا تنسى حمل المظلة معك اليوم' });
        tips.push({ icon: 'fa-car', text: 'قد تكون الطرق زلقة، قد بحذر أثناء القيادة' });
    }
    
    if (weatherMain === 'Thunderstorm') {
        tips.push({ icon: 'fa-bolt', text: 'تجنب الوقوف تحت الأشجار خلال العواصف الرعدية' });
        tips.push({ icon: 'fa-home', text: 'يفضل البقاء في المنزل حتى تمر العاصفة' });
    }
    
    if (weatherMain === 'Snow') {
        tips.push({ icon: 'fa-temperature-low', text: 'ارتدِ ملابس ثقيلة للحماية من البرد' });
        tips.push({ icon: 'fa-road', text: 'كن حذراً على الطرق قد تكون زلقة بسبب الثلوج' });
    }
    
    if (temp > 35) {
        tips.push({ icon: 'fa-water', text: 'اشرب كميات كافية من الماء لتجنب الجفاف' });
        tips.push({ icon: 'fa-sun', text: 'تجنب التعرض المباشر لأشعة الشمس' });
    }
    
    if (temp < 5) {
        tips.push({ icon: 'fa-thermometer-empty', text: 'الجو بارد جداً، ارتدِ ملابس ثقيلة' });
        tips.push({ icon: 'fa-hand-holding-heart', text: 'تأكد من تدفئة المنزل جيداً' });
    }
    
    if (humidity > 70) {
        tips.push({ icon: 'fa-tint', text: 'الرطوبة مرتفعة، قد تشعر بالاختناق' });
    }
    
    if (windSpeed > 30) {
        tips.push({ icon: 'fa-wind', text: 'الرياح قوية، احذر من الأجسام المتطايرة' });
    }
    
    if (tips.length === 0) {
        tips.push({ icon: 'fa-smile', text: 'طقس جميل! استمتع بيومك' });
    }
    
    return tips.slice(0, 4);
}

function displayWeatherTips(weatherMain, temp, humidity, windSpeed) {
    const container = document.getElementById('weatherTips');
    if (!container) return;
    
    const tips = generateWeatherTips(weatherMain, temp, humidity, windSpeed);
    container.innerHTML = '';
    tips.forEach(tip => {
        const tipDiv = document.createElement('div');
        tipDiv.className = 'tip-item';
        tipDiv.innerHTML = `
            <i class="fas ${tip.icon}"></i>
            <div class="tip-text">${tip.text}</div>
        `;
        container.appendChild(tipDiv);
    });
}

// ========================================
// MAP FUNCTIONS
// ========================================

function initMap() {
    if (weatherMap) weatherMap.remove();
    weatherMap = L.map('weatherMap').setView([currentLat, currentLon], 8);
    
    const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(weatherMap);
    
    updateMapLayer();
    
    L.marker([currentLat, currentLon]).addTo(weatherMap)
        .bindPopup(`<b>${currentCity}</b><br>الطقس الحالي`)
        .openPopup();
}

function updateMapLayer() {
    if (!weatherMap) return;
    
    // Remove existing overlay layers
    weatherMap.eachLayer(layer => {
        if (layer.options && layer.options.overlay) {
            weatherMap.removeLayer(layer);
        }
    });
    
    let layerUrl = '';
    switch(currentMapLayer) {
        case 'temp':
            layerUrl = `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${API_KEY}`;
            break;
        case 'clouds':
            layerUrl = `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${API_KEY}`;
            break;
        case 'precip':
            layerUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`;
            break;
        default:
            return;
    }
    
    if (API_KEY && API_KEY !== 'YOUR_API_KEY_HERE') {
        const overlayLayer = L.tileLayer(layerUrl, {
            opacity: 0.6,
            overlay: true
        }).addTo(weatherMap);
    }
}

// ========================================
// COMPARE CITIES FUNCTION
// ========================================

async function addCompareCity() {
    const cityName = prompt('أدخل اسم المدينة للمقارنة:');
    if (!cityName) return;
    
    if (compareCities.length >= 4) {
        showError('يمكنك مقارنة 4 مدن كحد أقصى');
        return;
    }
    
    showLoading();
    const weatherData = await fetchWeather(cityName);
    hideLoading();
    
    if (weatherData) {
        compareCities.push({
            name: weatherData.name,
            temp: weatherData.main.temp,
            humidity: weatherData.main.humidity,
            wind: weatherData.wind.speed,
            condition: weatherData.weather[0].main
        });
        saveCompareCities();
        displayCompareCities();
        showSuccess(`تمت إضافة ${weatherData.name} للمقارنة`);
    }
}

function removeCompareCity(index) {
    compareCities.splice(index, 1);
    saveCompareCities();
    displayCompareCities();
}

function saveCompareCities() {
    localStorage.setItem('compareCities', JSON.stringify(compareCities));
}

function displayCompareCities() {
    const container = document.getElementById('compareContainer');
    if (!container) return;
    
    if (compareCities.length === 0) {
        container.innerHTML = `
            <div class="compare-placeholder">
                <i class="fas fa-chart-line"></i>
                <p>اضغط على زر "إضافة مدينة" لمقارنة الطقس بين مدن مختلفة</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="compare-cities">
            ${compareCities.map((city, index) => `
                <div class="compare-city-card">
                    <button class="remove-compare-btn" onclick="removeCompareCity(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="compare-city-name">
                        <i class="fas fa-city"></i> ${city.name}
                    </div>
                    <div class="compare-temp">
                        ${Math.round(city.temp)}°
                    </div>
                    <div class="compare-details">
                        <div class="compare-detail">
                            <i class="fas fa-tint"></i>
                            <div>${city.humidity}%</div>
                        </div>
                        <div class="compare-detail">
                            <i class="fas fa-wind"></i>
                            <div>${Math.round(city.wind)} كم/س</div>
                        </div>
                        <div class="compare-detail">
                            <i class="fas ${getIconClass(city.condition)}"></i>
                            <div>${city.condition}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ========================================
// NOTIFICATIONS
// ========================================

async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';
        if (notificationPermission) {
            showSuccess('تم تفعيل الإشعارات بنجاح');
        } else {
            showError('الرجاء السماح بالإشعارات للحصول على تحديثات الطقس');
        }
    }
}

function sendNotification(title, body) {
    if (notificationPermission && document.hidden) {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

// ========================================
// SHARE WEATHER
// ========================================

function shareWeather() {
    const temp = document.getElementById('temperature').textContent;
    const condition = document.getElementById('condition').textContent;
    const city = document.getElementById('cityName').textContent;
    
    const shareText = `الطقس في ${city}: ${temp}°C، ${condition}`;
    
    if (navigator.share) {
        navigator.share({
            title: `طقس ${city}`,
            text: shareText,
            url: window.location.href
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareText);
        showSuccess('تم نسخ معلومات الطقس إلى الحافظة');
    }
}

// ========================================
// FAVORITES MANAGEMENT
// ========================================

function toggleFavorites() {
    const panel = document.getElementById('favoritesPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        displayFavorites();
    } else {
        panel.style.display = 'none';
    }
}

function displayFavorites() {
    const container = document.getElementById('favoritesList');
    if (!container) return;
    container.innerHTML = '';
    favorites.forEach(city => {
        const chip = document.createElement('div');
        chip.className = 'fav-chip';
        chip.innerHTML = `<i class="fas fa-city"></i> ${city}`;
        chip.onclick = () => {
            document.getElementById('searchInput').value = city;
            searchCity();
            document.getElementById('favoritesPanel').style.display = 'none';
        };
        container.appendChild(chip);
    });
    if (favorites.length === 0) {
        container.innerHTML = '<p style="color: rgba(255,255,255,0.7);">لا توجد مدن مفضلة. اضغط على النجمة لإضافتها</p>';
    }
}

function addToFavorites() {
    if (!favorites.includes(currentCity)) {
        favorites.push(currentCity);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        showSuccess(`تمت إضافة ${currentCity} إلى المفضلة`);
        displayFavorites();
    } else {
        showError(`${currentCity} موجودة بالفعل في المفضلة`);
    }
}

// ========================================
// SETTINGS & CONTROLS
// ========================================

function toggleUnit() {
    currentUnit = currentUnit === 'metric' ? 'imperial' : 'metric';
    const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
    document.getElementById('unitSymbol').textContent = unitSymbol;
    document.getElementById('tempUnit').textContent = unitSymbol;
    updateAllWeather();
    showSuccess(`تم تغيير وحدة القياس إلى ${unitSymbol}`);
}

function toggleTheme() {
    const isNight = document.body.classList.toggle('night-mode');
    const icon = document.querySelector('#themeToggle i');
    if (isNight) {
        icon.className = 'fas fa-sun';
        showSuccess('تم تفعيل الوضع النهاري');
    } else {
        icon.className = 'fas fa-moon';
        showSuccess('تم تفعيل الوضع الليلي');
    }
}

async function toggleLang() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.getElementById('langToggle').innerHTML = currentLang === 'ar' ? 'English' : 'عربي';
    await updateAllWeather();
    showSuccess(currentLang === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English');
}

// ========================================
// MAIN ACTIONS
// ========================================

async function updateAllWeather() {
    showLoading();
    const weatherData = await fetchWeather(currentCity);
    if (weatherData && weatherData.coord) {
        currentLat = weatherData.coord.lat;
        currentLon = weatherData.coord.lon;
        updateCurrentWeather(weatherData);
        
        const forecastData = await fetchForecast(currentLat, currentLon);
        if (forecastData) {
            displayHourlyForecast(forecastData);
            displayDailyForecast(forecastData);
            drawCharts(forecastData);
            
            // Display weather tips
            displayWeatherTips(
                weatherData.weather[0].main,
                weatherData.main.temp,
                weatherData.main.humidity,
                weatherData.wind.speed
            );
        }
        
        await updateExtraData(currentLat, currentLon);
        initMap();
        
        // Send notification if enabled
        sendNotification(`طقس ${currentCity}`, `${Math.round(weatherData.main.temp)}°C - ${weatherData.weather[0].description}`);
    }
    hideLoading();
}

async function searchCity() {
    const input = document.getElementById('searchInput');
    const city = input.value.trim();
    if (!city) {
        showError('الرجاء إدخال اسم المدينة');
        return;
    }
    
    document.getElementById('cityName').innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البحث...';
    
    const weatherData = await fetchWeather(city);
    if (weatherData && weatherData.coord) {
        currentCity = weatherData.name;
        currentLat = weatherData.coord.lat;
        currentLon = weatherData.coord.lon;
        updateCurrentWeather(weatherData);
        
        const forecastData = await fetchForecast(currentLat, currentLon);
        if (forecastData) {
            displayHourlyForecast(forecastData);
            displayDailyForecast(forecastData);
            drawCharts(forecastData);
            displayWeatherTips(
                weatherData.weather[0].main,
                weatherData.main.temp,
                weatherData.main.humidity,
                weatherData.wind.speed
            );
        }
        
        await updateExtraData(currentLat, currentLon);
        initMap();
        showSuccess(`تم تحميل طقس ${currentCity} بنجاح`);
    } else if (!weatherData) {
        document.getElementById('cityName').textContent = 'خطأ في البحث';
    }
}

async function getLocation() {
    if (navigator.geolocation) {
        showSuccess('جاري تحديد موقعك...');
        navigator.geolocation.getCurrentPosition(async (position) => {
            currentLat = position.coords.latitude;
            currentLon = position.coords.longitude;
            
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLon}&format=json`);
                const data = await response.json();
                currentCity = data.address?.city || data.address?.town || data.address?.village || 'موقعك';
                document.getElementById('cityName').textContent = currentCity;
                
                const weatherData = await fetchWeather(currentCity);
                if (weatherData) {
                    updateCurrentWeather(weatherData);
                    currentCity = weatherData.name;
                }
                
                const forecastData = await fetchForecast(currentLat, currentLon);
                if (forecastData) {
                    displayHourlyForecast(forecastData);
                    displayDailyForecast(forecastData);
                    drawCharts(forecastData);
                    if (weatherData) {
                        displayWeatherTips(
                            weatherData.weather[0].main,
                            weatherData.main.temp,
                            weatherData.main.humidity,
                            weatherData.wind.speed
                        );
                    }
                }
                
                await updateExtraData(currentLat, currentLon);
                initMap();
                showSuccess('تم تحديد موقعك بنجاح');
            } catch (error) {
                showError('تعذر الحصول على اسم المدينة');
            }
        }, () => showError('تعذر تحديد الموقع، يرجى تفعيل خدمات الموقع'));
    } else {
        showError('المتصفح لا يدعم تحديد الموقع');
    }
}

function refreshWeather() {
    cacheManager.clear();
    updateAllWeather();
    showSuccess('تم تحديث بيانات الطقس');
}

// Back to top button
function handleScroll() {
    const backToTop = document.getElementById('backToTop');
    if (window.scrollY > 300) {
        backToTop.style.display = 'flex';
    } else {
        backToTop.style.display = 'none';
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auto refresh every 30 minutes
function startAutoRefresh() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        updateAllWeather();
    }, 30 * 60 * 1000);
}

// ========================================
// MAP LAYER CONTROLS
// ========================================

function initMapControls() {
    document.getElementById('mapLayerTemp')?.addEventListener('click', () => {
        currentMapLayer = 'temp';
        document.querySelectorAll('.map-layer-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('mapLayerTemp').classList.add('active');
        updateMapLayer();
    });
    
    document.getElementById('mapLayerClouds')?.addEventListener('click', () => {
        currentMapLayer = 'clouds';
        document.querySelectorAll('.map-layer-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('mapLayerClouds').classList.add('active');
        updateMapLayer();
    });
    
    document.getElementById('mapLayerPrecip')?.addEventListener('click', () => {
        currentMapLayer = 'precip';
        document.querySelectorAll('.map-layer-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('mapLayerPrecip').classList.add('active');
        updateMapLayer();
    });
}

// ========================================
// INITIALIZATION
// ========================================

function init() {
    // Event listeners
    document.getElementById('searchBtn').onclick = searchCity;
    document.getElementById('gpsBtn').onclick = getLocation;
    document.getElementById('unitToggle').onclick = toggleUnit;
    document.getElementById('themeToggle').onclick = toggleTheme;
    document.getElementById('langToggle').onclick = toggleLang;
    document.getElementById('favoritesBtn').onclick = toggleFavorites;
    document.getElementById('closeFavs').onclick = () => document.getElementById('favoritesPanel').style.display = 'none';
    document.getElementById('addFavoriteBtn').onclick = addToFavorites;
    document.getElementById('refreshBtn').onclick = refreshWeather;
    document.getElementById('shareBtn').onclick = shareWeather;
    document.getElementById('notificationsBtn').onclick = requestNotificationPermission;
    document.getElementById('addCompareBtn').onclick = addCompareCity;
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCity();
    });
    
    // Back to top
    window.addEventListener('scroll', handleScroll);
    document.getElementById('backToTop').onclick = scrollToTop;
    
    // Map controls
    initMapControls();
    
    // Display compare cities
    displayCompareCities();
    
    // Start auto refresh
    startAutoRefresh();
    
    // Load initial weather
    updateAllWeather();
}

// Start the app
init();