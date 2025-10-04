import requests
import re
import isodate

API_KEY = "AIzaSyAPpw-HEzuGxm9vSTfWvWN5xE1P-Htcic4"
CHANNEL_HANDLE = "itelediconstudio"

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"

# --- helpers ---

def get_channel_id(handle):
    url = f"{YOUTUBE_CHANNELS_URL}?part=id&forHandle={handle}&key={API_KEY}"
    resp = requests.get(url).json()
    if "items" not in resp or not resp["items"]:
        raise ValueError(f"Could not resolve channel handle {handle}")
    return resp["items"][0]["id"]

def get_channel_videos(channel_id):
    videos = []
    page_token = None
    while True:
        url = (
            f"{YOUTUBE_SEARCH_URL}?key={API_KEY}&channelId={channel_id}"
            f"&part=snippet,id&order=date&maxResults=50&type=video"
        )
        if page_token:
            url += f"&pageToken={page_token}"
        resp = requests.get(url).json()
        for item in resp.get("items", []):
            videos.append({
                "videoId": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "description": item["snippet"].get("description", "")
            })
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return videos

def get_video_details(video_ids):
    ids = ",".join(video_ids)
    url = f"{YOUTUBE_VIDEOS_URL}?key={API_KEY}&id={ids}&part=contentDetails,snippet"
    resp = requests.get(url).json()
    details = {}
    for item in resp.get("items", []):
        vid = item["id"]
        duration = isodate.parse_duration(item["contentDetails"]["duration"]).total_seconds()
        category = item["snippet"].get("categoryId", "Unknown")
        description = item["snippet"].get("description", "")
        details[vid] = {
            "duration": duration,
            "category": category,
            "description": description
        }
    return details

def clean_title(title):
    # keep only the first part before "-" or "|"
    title = re.split(r"[-|]", title)[0].strip()
    return title

def extract_stars(title, description):
    # stars usually appear after movie name in title or inside description
    combined = title + " " + description
    # crude actor name match (capitalized words)
    matches = re.findall(r"\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*", combined)
    ignore = {"Latest", "Yoruba", "Movie", "Drama", "Part", "Episode"}
    stars = [m for m in matches if m not in ignore]
    return list(dict.fromkeys(stars))  # unique, keep order

# --- main ---

def main():
    print("Starting movie fetch...")

    channel_id = get_channel_id(CHANNEL_HANDLE)
    videos = get_channel_videos(channel_id)

    # newest first
    videos = videos[:]

    # fetch details in batches
    all_ids = [v["videoId"] for v in videos]
    movies = []
    for i in range(0, len(all_ids), 50):
        batch = all_ids[i:i+50]
        details = get_video_details(batch)
        for v in videos[i:i+50]:
            vid = v["videoId"]
            if vid not in details:
                continue
            d = details[vid]
            minutes = int(d["duration"] // 60)

            # skip trailers (less than 15 min)
            if minutes < 15:
                continue

            title = clean_title(v["title"])
            stars = extract_stars(v["title"], d["description"])
            desc = d["description"].split("\n")[0:5]  # first 5 lines only
            desc = " ".join([x.strip() for x in desc if x.strip()])

            movies.append({
                "title": title,
                "category": d["category"],
                "stars": stars if stars else ["Unknown"],
                "duration": minutes,
                "description": desc if desc else "No description"
            })

    if not movies:
        print("✅ No full movies found.")
    else:
        for m in movies:
            print("\n✅ New Movie Added!")
            print(f"Title: {m['title']}")
            print(f"Category: {m['category']}")
            print(f"Stars: {', '.join(m['stars'])}")
            print(f"Duration: {m['duration']} minutes")
            print(f"Description: {m['description'][:300]}")

if __name__ == "__main__":
    main()