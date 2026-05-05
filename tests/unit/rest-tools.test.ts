import assert from "node:assert/strict";
import test from "node:test";
import { restToolFromEndpoint } from "@/lib/rest/tools";

test("REST tool metadata maps endpoint parameters without MCP JSON-RPC envelope", () => {
  const tool = restToolFromEndpoint({
    name: "weather_lookup",
    title: "Weather lookup",
    description: "Returns deterministic weather data.",
    parameters: [
      {
        name: "city",
        label: "City",
        description: "City to look up.",
        type: "string",
        required: true,
        defaultValueJson: '"Seoul"',
      },
      {
        name: "metric",
        label: "",
        description: "",
        type: "boolean",
        required: false,
        defaultValueJson: "true",
      },
      {
        name: "days",
        label: "Days",
        description: "",
        type: "number",
        required: false,
        defaultValueJson: null,
      },
    ],
  });

  assert.deepEqual(tool, {
    name: "weather_lookup",
    title: "Weather lookup",
    description: "Returns deterministic weather data.",
    parameters: [
      {
        name: "city",
        label: "City",
        description: "City to look up.",
        type: "string",
        required: true,
        defaultValue: "Seoul",
      },
      {
        name: "metric",
        label: "",
        description: "",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      {
        name: "days",
        label: "Days",
        description: "",
        type: "number",
        required: false,
      },
    ],
  });
});
