<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Textbook Videos</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <header class="page-header">
    <h1>Textbook Video Library</h1>
    <div class="controls">
      <button id="toggle-all">Expand all</button>
    </div>
  </header>

  <main>
    <section id="books" aria-label="Book list">
      <div class="loading">Loading textbooks…</div>
    </section>

    <section id="request-videos" class="request-section">
      <h2>Request videos for a listed textbook</h2>
      <p>If a lesson is missing a solution video, click the request button beside that lesson or use this form.</p>
      <form>
        <label for="request-details">Details</label>
        <textarea id="request-details" name="request-details" rows="4" placeholder="Tell us which chapter/lesson needs a video."></textarea>
        <button type="submit">Submit request</button>
      </form>
    </section>
  </main>

  <script src="assets/main.js"></script>
</body>
</html>
