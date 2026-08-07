const STREAMING_API_URL = "http://172.20.10.14:3000";

export async function searchSongs(query: string) {
  const res = await fetch(
    `${STREAMING_API_URL}/api/search?q=${encodeURIComponent(query)}`
  );

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || "Search failed");
  }

  return json.data;
}

export async function getStream(id: string) {
  const res = await fetch(
    `${STREAMING_API_URL}/api/songs/${id}`
  );

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || "Stream failed");
  }

  return json.data;
}