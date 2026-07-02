import { describe, expect, it } from 'vitest'
import { youtubeId, youtubeEmbedUrl } from '../lib/youtube'

const ID = 'dQw4w9WgXcQ' // 11-char sample id

describe('youtubeId', () => {
  it('parses the standard watch URL', () => {
    expect(youtubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(youtubeId(`https://www.youtube.com/watch?v=${ID}&t=42s`)).toBe(ID)
  })

  it('parses short, embed, shorts and live forms', () => {
    expect(youtubeId(`https://youtu.be/${ID}`)).toBe(ID)
    expect(youtubeId(`https://youtu.be/${ID}?t=10`)).toBe(ID)
    expect(youtubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
    expect(youtubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(youtubeId(`https://www.youtube.com/live/${ID}`)).toBe(ID)
  })

  it('handles m. and nocookie hosts and a bare id', () => {
    expect(youtubeId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(youtubeId(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(ID)
    expect(youtubeId(ID)).toBe(ID)
    expect(youtubeId(`  ${ID}  `)).toBe(ID)
  })

  it('rejects non-YouTube or malformed input', () => {
    expect(youtubeId('')).toBeNull()
    expect(youtubeId(null)).toBeNull()
    expect(youtubeId('not a url')).toBeNull()
    expect(youtubeId('https://vimeo.com/12345')).toBeNull()
    expect(youtubeId('https://www.youtube.com/watch?v=tooshort')).toBeNull()
    expect(youtubeId('https://evil.com/watch?v=' + ID)).toBeNull()
  })
})

describe('youtubeEmbedUrl', () => {
  it('builds a nocookie embed URL for valid input', () => {
    expect(youtubeEmbedUrl(`https://youtu.be/${ID}`)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}`
    )
  })

  it('returns null for invalid input', () => {
    expect(youtubeEmbedUrl('https://vimeo.com/12345')).toBeNull()
    expect(youtubeEmbedUrl('')).toBeNull()
  })
})
