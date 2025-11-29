(async function () {
  const booksContainer = document.getElementById('books');
  const toggleAllBtn = document.getElementById('toggle-all');
  let allExpanded = false;

  const fetchBook = async () => {
    const res = await fetch('../data/mcv4u.json');
    if (!res.ok) throw new Error('Failed to load textbook data');
    return res.json();
  };

  const buildVideoList = (videos) => {
    const valid = videos.filter(v => v.url);
    if (!valid.length) {
      const wrapper = document.createElement('div');
      wrapper.className = 'no-videos';
      const text = document.createElement('span');
      text.textContent = 'No video(s)';
      const btn = document.createElement('button');
      btn.className = 'request-btn';
      btn.type = 'button';
      btn.textContent = 'Request video(s)';
      btn.addEventListener('click', () => {
        document.getElementById('request-videos')?.scrollIntoView({ behavior: 'smooth' });
      });
      wrapper.append(text, btn);
      return wrapper;
    }
    const list = document.createElement('ul');
    list.className = 'videos';
    valid.forEach(v => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = v.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${v.id} ${v.prompt}`.trim();
      li.appendChild(link);
      list.appendChild(li);
    });
    return list;
  };

  const buildLesson = (lesson) => {
    const details = document.createElement('details');
    details.className = 'lesson';
    const summary = document.createElement('summary');
    summary.textContent = lesson.title;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.appendChild(buildVideoList(lesson.videos || []));
    details.appendChild(body);
    return details;
  };

  const buildChapter = (chapter) => {
    const details = document.createElement('details');
    details.className = 'chapter';
    const summary = document.createElement('summary');
    summary.textContent = chapter.title;
    details.appendChild(summary);

    const lessonList = document.createElement('div');
    (chapter.lessons || []).forEach(lesson => lessonList.appendChild(buildLesson(lesson)));
    details.appendChild(lessonList);
    return details;
  };

  const renderBook = (book) => {
    const card = document.createElement('article');
    card.className = 'book-card';
    const title = document.createElement('h2');
    title.textContent = book.title;
    card.appendChild(title);

    (book.chapters || []).forEach(ch => card.appendChild(buildChapter(ch)));
    booksContainer.innerHTML = '';
    booksContainer.appendChild(card);
  };

  const setAllDetails = (open) => {
    document.querySelectorAll('#books details').forEach(d => {
      d.open = open;
    });
    allExpanded = open;
    toggleAllBtn.textContent = open ? 'Collapse all' : 'Expand all';
  };

  toggleAllBtn?.addEventListener('click', () => setAllDetails(!allExpanded));

  try {
    const book = await fetchBook();
    renderBook(book);
  } catch (err) {
    booksContainer.innerHTML = '<div class="error">Failed to load videos.</div>';
    console.error(err);
  }
})();
