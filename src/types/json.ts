export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray; // | string | number | boolean | null | { [key: string]: Json } | Json[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

