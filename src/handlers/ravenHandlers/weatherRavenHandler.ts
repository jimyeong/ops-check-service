import type { WeatherRaven } from "../../domain/ravens/weatherRaven";
import { weatherRavenService } from "../../services/ravenServices/weatherRavenService";

export const handleWeatherRaven = async (msg: string): Promise<boolean> => {
    const payload = JSON.parse(msg) as WeatherRaven;
    try {
        const reading: WeatherRaven = {
            temperature: payload.temperature,
            humidity: payload.humidity,
            dew_point: payload.dew_point,
            precipitation: payload.precipitation,
            cloud_cover: payload.cloud_cover,
            wind_speed: payload.wind_speed,
            weather_code: payload.weather_code,
            last_seen: payload.last_seen
        };
        const result = await weatherRavenService(reading);
        if (!result) {
            throw new Error("Failed to insert weather raven reading");
        }
        return true;
    } catch (e) {
        console.error(`Failed to handle weather raven reading: ${e}`);
        return false;
    }
}