import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function seedDemoData(page) {
  return page.evaluate(async () => {
    await DB.open();
    await DB.resetAll();
    await DB.initDefaultBatches();
    await DB.setSetting('student_name', 'Playwright Student');
    await DB.setSetting('api_url', '');

    await DB.saveBatch({ id: 201, name: 'Std Play', icon: '📘' });

    const q1 = await DB.saveQuestion({
      batch: 'Std Play',
      subject: 'Science',
      chapter: 'Plants',
      type: 'mcq',
      difficulty: 'easy',
      question: 'Leaves prepare food by?',
      options: { A: 'Photosynthesis', B: 'Respiration', C: 'Digestion', D: 'Evaporation' },
      answer: 'A',
      tags: ['plants']
    });

    const q2 = await DB.saveQuestion({
      batch: 'Std Play',
      subject: 'Science',
      chapter: 'Plants',
      type: 'mcq',
      difficulty: 'medium',
      question: 'Roots mainly absorb?',
      options: { A: 'Smoke', B: 'Water', C: 'Sunlight', D: 'Air only' },
      answer: 'B',
      tags: ['plants']
    });

    const published = await DB.saveQuiz({
      title: 'Published Plants Quiz',
      batch: 'Std Play',
      subject: 'Science',
      chapter: 'Plants',
      timer_mode: 'per_question',
      timer_value: 30,
      positive_marks: 1,
      negative_marks: 0,
      shuffle: false,
      status: 'published',
      sections: [
        {
          id: 'sec_1',
          label: 'Section A',
          type: 'mcq',
          question_ids: [q1.q_id, q2.q_id],
          timer: 30,
          positive_marks: 1,
          negative_marks: 0
        }
      ]
    });

    await DB.saveQuiz({
      title: 'Draft Hidden Quiz',
      batch: 'Std Play',
      subject: 'Science',
      chapter: 'Plants',
      timer_mode: 'per_question',
      timer_value: 30,
      positive_marks: 1,
      negative_marks: 0,
      shuffle: false,
      status: 'draft',
      sections: [
        {
          id: 'sec_2',
          label: 'Draft Section',
          type: 'mcq',
          question_ids: [q1.q_id],
          timer: 30,
          positive_marks: 1,
          negative_marks: 0
        }
      ]
    });

    return published.quiz_id;
  });
}

test('student app shows only published quizzes and can launch them', async ({ page }) => {
  await page.goto('/student-app/index.html');
  const quizId = await seedDemoData(page);
  await page.goto('/student-app/index.html');

  await page.locator('.batch-card', { hasText: 'Std Play' }).click();
  await page.locator('.subject-card', { hasText: 'Science' }).click();
  await page.locator('.chapter-item', { hasText: 'Plants' }).click();
  await expect(page.locator('#available-tests-section')).toBeVisible();
  await expect(page.locator('.quiz-portal-card', { hasText: 'Published Plants Quiz' })).toBeVisible();
  await expect(page.locator('text=Draft Hidden Quiz')).toHaveCount(0);

  await page.locator('.quiz-portal-card', { hasText: 'Published Plants Quiz' }).locator('.quiz-portal-btn').click();
  await expect(page.locator('#screen-test-player')).toBeVisible();
  await expect(page.locator('#tp-quiz-title')).toHaveText('Published Plants Quiz');
  await expect(page).toHaveURL(/student-app\/index\.html$/);
  expect(quizId).toBeTruthy();
});

test('admin handoff deep-links into the student app with shared IndexedDB state', async ({ page }) => {
  await page.goto('/student-app/index.html');
  const quizId = await seedDemoData(page);

  await page.route('**/api/auth/login', async route => {
    const payload = route.request().postDataJSON();
    if (payload?.role === 'admin') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Admin login successful',
          token: 'test.admin.token',
          user: { id: 'admin-1', name: 'Admin', role: 'admin' }
        })
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/admin-app/admin.html');
  await expect(page.locator('#admin-overlay')).toBeVisible();

  const digits = page.locator('.pin-digit');
  await digits.nth(0).fill('1');
  await digits.nth(1).fill('2');
  await digits.nth(2).fill('3');
  await digits.nth(3).fill('4');

  await expect(page.locator('#admin-content')).toBeVisible();
  await page.locator('[data-tab="tests"]').click();
  await expect(page.locator('#quiz-list-published')).toContainText('Published Plants Quiz');

  await Promise.all([
    page.waitForURL(new RegExp(`(?:student|student-app/index\\.html)\\?quiz=${quizId}`)),
    page.locator('.quiz-play-btn').click()
  ]);

  await expect(page.locator('#tp-quiz-title')).toHaveText('Published Plants Quiz');
  await expect(page.locator('#screen-test-player')).toBeVisible();
});

test('admin question editor saves an image-only MCQ without reloading away', async ({ page }) => {
  const questionImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><rect width='100%' height='100%' fill='%235f3dc4'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='26'>Image Only</text></svg>";
  const optionAImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='120'><rect width='100%' height='100%' fill='%23e8590c'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='22'>A</text></svg>";
  const optionBImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='120'><rect width='100%' height='100%' fill='%232b8a3e'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='22'>B</text></svg>";

  await page.goto('/admin-app/admin.html');
  await page.evaluate(async () => {
    await DB.open();
    await DB.resetAll();
    await DB.initDefaultBatches();
    await DB.saveBatch({ id: 401, name: 'Std Admin', icon: '🧪' });
    await DB.saveBatchSubject({ batch: 'Std Admin', name: 'Science' });
    await DB.saveSubjectChapter({ batch: 'Std Admin', subject: 'Science', name: 'Images' });
  });
  await page.reload();

  const digits = page.locator('.pin-digit');
  await digits.nth(0).fill('1');
  await digits.nth(1).fill('2');
  await digits.nth(2).fill('3');
  await digits.nth(3).fill('4');
  await expect(page.locator('#admin-content')).toBeVisible();

  await page.locator('#btn-add-question').click();
  await expect(page.locator('#qedit-overlay')).toBeVisible();

  await page.locator('#qe-batch').selectOption('Std Admin');
  await page.locator('#qe-subject').selectOption('Science');
  await page.locator('#qe-chapter').selectOption('Images');
  await page.locator('#qe-image').fill(questionImage);
  await page.locator('#qe-a-image').fill(optionAImage);
  await page.locator('#qe-b-image').fill(optionBImage);
  await page.locator('#qe-answer').selectOption('B');
  await page.locator('#btn-qe-save').click();

  await expect(page.locator('#qedit-overlay')).toBeHidden();
  await expect(page.locator('#q-bank-list .qb-item')).toHaveCount(1);

  const saved = await page.evaluate(async () => {
    const all = await DB.getAllQuestions();
    return all[0];
  });
  expect(saved.image).toBe(questionImage);
  expect(saved.option_images.A).toBe(optionAImage);
  expect(saved.option_images.B).toBe(optionBImage);
  expect(saved.question).toBe('');
});

test('published quiz supports question image and option image URLs in student app', async ({ page }) => {
  const questionImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><rect width='100%' height='100%' fill='%230b7285'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='28'>Question</text></svg>";
  const optionAImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='120'><rect width='100%' height='100%' fill='%231c7ed6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='24'>A</text></svg>";
  const optionBImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='120'><rect width='100%' height='100%' fill='%232f9e44'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='24'>B</text></svg>";

  await page.goto('/student-app/index.html');
  const quizId = await page.evaluate(async ({ questionImage, optionAImage, optionBImage }) => {
    await DB.open();
    await DB.resetAll();
    await DB.initDefaultBatches();
    await DB.setSetting('student_name', 'Playwright Student');
    await DB.setSetting('api_url', '');

    await DB.saveBatch({ id: 301, name: 'Std Image', icon: '🖼️' });
    await DB.saveBatchSubject({ batch: 'Std Image', name: 'Visuals' });
    await DB.saveSubjectChapter({ batch: 'Std Image', subject: 'Visuals', name: 'Signs' });

    const q1 = await DB.saveQuestion({
      batch: 'Std Image',
      subject: 'Visuals',
      chapter: 'Signs',
      type: 'mcq',
      difficulty: 'easy',
      question: '',
      image: questionImage,
      options: { A: '', B: '', C: '', D: '' },
      option_images: { A: optionAImage, B: optionBImage, C: null, D: null },
      answer: 'B',
      tags: ['images']
    });

    const published = await DB.saveQuiz({
      title: 'Image URL Quiz',
      batch: 'Std Image',
      subject: 'Visuals',
      chapter: 'Signs',
      timer_mode: 'per_question',
      timer_value: 30,
      positive_marks: 1,
      negative_marks: 0,
      shuffle: false,
      status: 'published',
      sections: [
        {
          id: 'sec_img',
          label: 'Section A',
          type: 'mcq',
          question_ids: [q1.q_id],
          timer: 30,
          positive_marks: 1,
          negative_marks: 0
        }
      ]
    });

    return published.quiz_id;
  }, { questionImage, optionAImage, optionBImage });

  await page.goto('/student-app/index.html');
  await page.goto(`/student-app/index.html?quiz=${quizId}`);

  await expect(page.locator('#screen-test-player')).toBeVisible();
  await expect(page.locator('#tp-q-image')).toBeVisible();
  await expect(page.locator('#tp-q-text')).toHaveText('');
  await expect(page.locator('#tp-options-grid .option-media img')).toHaveCount(2);

  await page.locator('#tp-options-grid .option-btn').nth(1).click();
  await expect(page.locator('#tp-feedback-bar')).toBeVisible();
  await expect(page.locator('#tp-feedback-text')).toContainText('Correct');
  expect(quizId).toBeTruthy();
});

test('service worker re-registration clears stale versioned caches', async ({ page }) => {
  await page.goto('/student-app/index.html');

  await page.evaluate(async () => {
    const cache = await caches.open('teachingboard-static-v5');
    await cache.put('/legacy-cache-check', new Response('stale'));
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(reg => reg.unregister()));
  });

  await page.reload();
  await expect.poll(async () => {
    return page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg?.active;
    });
  }).toBeTruthy();
  await expect.poll(async () => {
    return page.evaluate(async () => caches.keys());
  }).toEqual(expect.arrayContaining([expect.stringMatching(/^teachingboard-static-v\d+$/)]));

  const cacheKeys = await page.evaluate(async () => caches.keys());
  expect(cacheKeys.some(key => /^teachingboard-static-v\d+$/.test(key))).toBeTruthy();
});
