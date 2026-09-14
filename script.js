// ============================================
// Jan.ai Clone - JavaScript
// ============================================

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
    });
  }

  // Scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

  // Populate testimonials marquee
  const marqueeTrack = document.getElementById('marqueeTrack');
  if (marqueeTrack) {
    const tweets = [
      { name: '@nerdai_devgod', handle: '', text: 'For a year now, I\'ve been using @jandotai for almost all of my local dev work (via its local API). Open source, affordable, & you can use any model you want.' },
      { name: 'MiniMax', handle: '@MiniMaxAI', text: 'Discover MiniMax-01, the groundbreaking open-source model with 456 billion parameters. Try it now on @jandotai.' },
      { name: 'James', handle: '@James85921622', text: 'This @jandotai is a real hidden gem. I absolutely love it. Honestly it gives me those old Chromebook vibes.' },
      { name: '@husainshafique', handle: '', text: 'For years I have been waiting for a good ChatGPT alternative. @jandotai is the first product I have used that matches my experience.' },
      { name: 'Ahmed El Gabri', handle: '@aaborabs', text: 'Jan AI is a real hidden gem. I absolutely love it. Seriously, it gives me those old Chromebook vibes.' },
      { name: '@arsaboo', handle: '', text: 'The memory feature is a game-changer! @jandotai now remembers everything—projects, preferences, everything.' },
      { name: '@mariansor', handle: '', text: 'Love the commitment to local-first. No telemetry, no BS. Just AI that works.' },
      { name: '@aichemist_ai', handle: '', text: 'Running Jan on my M2 Mac Mini. Incredibly fast inference with Qwen 2.5 7B. This is the future.' },
      { name: '@tensor_ux', handle: '', text: 'The UI/UX of @jandotai is what convinced me to switch. It just feels right. Clean, fast, no nonsense.' },
      { name: '@jackAIdev', handle: '', text: 'Finally, an AI that runs fully offline without compromising on quality. Jan nails it.' },
    ];

    const createTweetHTML = (tweet) => `
      <div class="tweet-card">
        <div class="tweet-header">
          <img src="images/cute-robot.png" alt="" class="tweet-avatar">
          <div class="tweet-user">
            <div class="tweet-name">${tweet.name}</div>
            ${tweet.handle ? `<div class="tweet-handle">${tweet.handle}</div>` : ''}
          </div>
          <a href="#" class="tweet-link-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        </div>
        <div class="tweet-text">${tweet.text}</div>
      </div>
    `;

    // Double the tweets for infinite scroll
    const allTweets = [...tweets, ...tweets];
    marqueeTrack.innerHTML = allTweets.map(createTweetHTML).join('');
  }

  // Research page filter buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');
        const featured = document.querySelector('.research-featured');
        const cards = document.querySelectorAll('.research-card');

        if (filter === 'all') {
          if (featured) featured.style.display = 'block';
          cards.forEach(c => c.style.display = 'block');
        } else {
          if (featured) {
            const tags = featured.getAttribute('data-tags') || '';
            featured.style.display = tags.includes(filter) ? 'block' : 'none';
          }
          cards.forEach(c => {
            const tags = c.getAttribute('data-tags') || '';
            c.style.display = tags.includes(filter) ? 'block' : 'none';
          });
        }
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
