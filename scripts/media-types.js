const IMAGE_EXTENSIONS = new Set("png jpg jpeg jfif gif webp svg bmp avif apng ico tif tiff heic heif jxl".split(" "));
const VIDEO_EXTENSIONS = new Set("mp4 m4v webm mov ogv mkv avi mpeg mpg 3gp".split(" "));
const AUDIO_EXTENSIONS = new Set("mp3 m4a aac ogg oga opus wav flac weba aif aiff wma mid midi".split(" "));
const FILE_EXTENSIONS = new Set("pdf txt md rtf csv tsv doc docx odt xls xlsx ods ppt pptx odp zip rar 7z tar gz bz2 xz json epub lcp".split(" "));

function extensionOf(name) {
  return name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? "";
}

function kindOf(extension) {
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  return "file";
}

export function describeFile(file) {
  const extensionKind = kindOf(extensionOf(file.name));
  const mimeKind = file.type?.split("/")[0];
  const kind = extensionKind !== "file" ? extensionKind
    : (["image", "video", "audio"].includes(mimeKind) ? mimeKind : "file");
  return { kind, name: file.name, loop: false };
}

function filenameOf(pathname) {
  const encoded = pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function describeLink(source, { explicit = false } = {}) {
  if (!source || /[\s<>"'\\]/.test(source) || !/^https?:\/\//i.test(source)) return null;

  let url;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;

  const { hostname, pathname } = url;
  const imgur = /^(?:i\.)?imgur\.com$/.test(hostname);
  const tenorMedia = /^(?:media|c)\.tenor\.com$/.test(hostname);
  const tenorPage = /^(?:www\.)?tenor\.com$/.test(hostname) && pathname.startsWith("/view/");
  const giphyMedia = /^(?:media\d*|i)\.giphy\.com$/.test(hostname);
  const giphyPage = /^(?:www\.)?giphy\.com$/.test(hostname) && pathname.startsWith("/gifs/");
  const discord = /^(?:cdn|media|images-ext-\d+)\.discord(?:app)?\.(?:com|net)$/.test(hostname)
    && /^\/(?:attachments|ephemeral-attachments|external)\//.test(pathname);
  const name = filenameOf(pathname);
  const extension = extensionOf(name);

  if (giphyPage) {
    const id = name.match(/(?:^|-)([a-z0-9]+)$/i)?.[1];
    if (id) return { src: `https://media.giphy.com/media/${id}/giphy.gif`, kind: "image", name, loop: false };
  }

  if (imgur) {
    const id = pathname.match(/^\/(?:gallery\/)?([a-z0-9]+)(?:\.gifv)?$/i)?.[1];
    if (id && extension === "gifv") {
      return { src: `https://i.imgur.com/${id}.mp4${url.search}${url.hash}`, kind: "video", name, loop: true };
    }
    if (id) return { src: `https://i.imgur.com/${id}.png`, kind: "image", name, loop: false };
  }

  // Discord's proxy can serve a different format from the filename in the URL.
  const format = discord ? url.searchParams.get("format")?.toLowerCase() : "";
  const formatKind = kindOf(format);
  const kind = formatKind !== "file" ? formatKind : kindOf(extension);
  if (kind === "file" && !explicit && !FILE_EXTENSIONS.has(extension) && !discord && !tenorPage) return null;

  return {
    src: source,
    kind,
    name: name || hostname,
    loop: kind === "video" && (discord || tenorMedia || giphyMedia),
    tenorPage
  };
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
