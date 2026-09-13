# ethandenny.dev

My personal site

## Writing editor

Run `npm run editor`, then open http://127.0.0.1:4321. The local editor starts
the site preview on http://127.0.0.1:4322 and saves posts as Markdown in
`src/content/writing`.

## Images in posts

Regular Markdown images remain full-size and responsive. Use HTML when an image
needs a specific layout:

```html
<img
  class="image-small image-center"
  src="/images/example.png"
  alt="Description"
/>
```

Available classes are `image-small`, `image-medium`, `image-left`,
`image-center`, `image-right`, and `image-crop`. Combine them as needed.

Use `image-row` for a responsive two-image layout:

```html
<div class="image-row">
  <img src="/images/one.png" alt="First image" />
  <img src="/images/two.png" alt="Second image" />
</div>
```
