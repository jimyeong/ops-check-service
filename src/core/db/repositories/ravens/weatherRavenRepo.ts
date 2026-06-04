import type { WeatherRaven } from "../../../../domain/ravens/weatherRaven";
import { pool } from "../../pool";

export const insertWeatherRavenReading = async (reading: WeatherRaven): Promise<boolean> => {
    const q = `
    INSERT INTO raven_weather_readings (
        temperature,
        humidity,
        dew_point,
        precipitation,
        cloud_cover,
        wind_speed,
        weather_code,
        last_seen
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
    )
    `
    try{
        await pool.query(q, [
            reading.temperature,
            reading.humidity,
            reading.dew_point,
            reading.precipitation,
            reading.cloud_cover,
            reading.wind_speed,
            reading.weather_code,
            reading.last_seen
        ])
        return true;
    }catch(error){
        if (error instanceof Error){
            console.error("Failed to insert weather raven reading: ", error.message);
        }else{
            console.error(`Failed to insert weather raven reading: An unknown error occured.`, error);
        }
        
        return false
    }
}