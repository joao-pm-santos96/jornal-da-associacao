const IMAGE_URL = /^https?:\/\/\S+\.(?:gif|png|jpe?g|webp)(?:\?\S*)?$/i;
const GIPHY_PAGE = /^https?:\/\/(?:www\.)?giphy\.com\/gifs\/(?:\S*-)?([A-Za-z0-9]+)\/?$/i;

function embed(line: string): string {
  const trimmed = line.trim();
  const giphy = trimmed.match(GIPHY_PAGE);
  if (giphy) return `![GIF](https://media.giphy.com/media/${giphy[1]}/giphy.gif)`;
  if (IMAGE_URL.test(trimmed)) return `![imagem](${trimmed})`;
  return line;
}

export function commentToMarkdown(body: string): string {
  return body.split("\n").map(embed).join("  \n");
}
