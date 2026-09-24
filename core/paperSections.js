/* ════════════════════════════════════════
   paperSections.js — board-style paper structure for the Paper Builders
   Global: PAPER_SECTIONS
   Shared by admin-app/paperBuilder.js and student-app/teacherPaperBuilder.js.

   A "board-style" paper is split into sections such as
     Q.1 (A)  "Choose the correct alternative"        1 mark each, attempt all 4
     Q.2 (A)  "Complete the activities (any two)"     2 marks each, attempt any 2 of 3
   Section marks = attempt x marks each, and the paper total is the sum of the
   sections - never the sum of every printed question - so "any two of three" keeps
   the total right. This module owns the panel UI (header fields + sections table +
   live marks check) and the state; each builder only calls create()/mount() and
   asks it for payload()/summary().
════════════════════════════════════════ */

const PAPER_SECTIONS = (() => {
  // Board paper templates. Data-driven: the picker groups by `board` then lists `subject`s, so adding
  // HSC (or any other board) is just new entries here — no UI change. Passage sections (kind:'passage')
  // take their marks from whichever PassageBlock is chosen, so a template leaves those unset.
  const _P = (qNo, part, instruction) => ({ kind: 'passage', qNo, part, instruction, passageBlockId: '', marksEach: 0, attempt: 1 });
  const _Q = (qNo, part, instruction, marksEach, attempt) => ({ qNo, part, instruction, marksEach, attempt });
  const TEMPLATES = {
    ssc_english_80_draft: {
      board: 'SSC',
      subject: 'English (First Language) - 80 marks [draft, verify marks]',
      label: 'SSC English - 80 marks',
      sections: [
        _P('1', 'A', 'Read the following passage and do the activities :'),
        _P('2', 'A', 'Read the following unseen passage and do the activities :'),
        _P('3', '', 'Read the following poem and do the activities :'),
        { qNo: '4', part: '', instruction: 'Do as directed (Grammar) :', marksEach: 2, attempt: 5 },
        _P('5', 'A', 'Write a letter as directed :'),
        _P('5', 'B', 'Write a speech / story / report as directed :'),
        _P('6', '', 'Study the following information and do the activities :'),
      ],
      header: {
        subjectLine: 'ENGLISH (FIRST LANGUAGE)',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 3 Hours',
        notes: [
          'All questions are compulsory.',
          'The numbers to the right of the questions indicate full marks.',
          'Write the answers in your own words as far as possible.',
        ],
      },
    },
    // Templates below follow the real March-2026 SSC papers (N 801/917/932/940/953/961/969). Passage
    // sections take their marks from the chosen block; question sections' marks are the paper's own
    // (Marathi/Hindi grammar & writing sub-parts are approximated as marksEach x attempt — editable after loading).
    ssc_marathi_80: {
      board: 'SSC',
      subject: 'Marathi (First Language) - 80 marks',
      label: 'SSC Marathi - 80 marks',
      sections: [
        _P('1', 'अ', 'उताऱ्याच्या आधारे सूचनेनुसार कृती करा :'),
        _P('1', 'आ', 'उताऱ्याच्या आधारे सूचनेनुसार कृती करा :'),
        _P('1', 'इ', 'अपठित गद्य - उताऱ्याच्या आधारे सूचनेनुसार कृती करा :'),
        _P('2', 'अ', 'कवितेच्या आधारे सूचनेनुसार कृती करा :'),
        _Q('2', 'आ', 'खालील मुद्द्यांच्या आधारे कोणत्याही एका कवितेसंबंधी खालील कृती सोडवा :', 4, 1),
        _Q('2', 'इ', 'खाली दिलेल्या काव्यपंक्तींचे रसग्रहण करा :', 4, 1),
        _Q('3', '', 'खालीलपैकी कोणत्याही दोन कृती सोडवा :', 3, 2),
        _Q('4', 'अ', 'व्याकरण घटकांवर आधारित कृती :', 2, 4),
        _Q('4', 'आ', 'भाषिक घटकांवर आधारित कृती :', 1, 8),
        _P('5', 'अ', 'खालील कृती सोडवा (पत्रलेखन) :'),
        _Q('5', 'आ', 'खालीलपैकी कोणत्याही दोन कृती सोडवा :', 5, 2),
        _Q('5', 'इ', 'खालील लेखनप्रकारांपैकी कोणतीही एक कृती सोडवा :', 8, 1),
      ],
      header: {
        subjectLine: 'MARATHI FIRST LANGUAGE - 01',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 3 Hours',
        notes: [
          'सूचनेनुसार आकलनकृती व व्याकरण यांमधील आकृत्या काढाव्यात.',
          'आकृत्या पेननेच काढाव्यात.',
          'उपयोजित लेखनातील कृतींसाठी (सूचना, निवेदन) आकृतीची आवश्यकता नाही.',
          'स्वच्छता, नीटनेटकेपणा व लेखननियमांनुसार लेखन यांकडे जाणीवपूर्वक लक्ष द्यावे.',
        ],
      },
    },
    ssc_hindi_80: {
      board: 'SSC',
      subject: 'Hindi (Second/Third Language) - 80 marks',
      label: 'SSC Hindi - 80 marks',
      sections: [
        _P('1', 'अ', 'निम्नलिखित पठित गद्यांश पढ़कर दी गई सूचनाओं के अनुसार कृतियाँ कीजिए :'),
        _P('1', 'आ', 'निम्नलिखित पठित गद्यांश पढ़कर दी गई सूचनाओं के अनुसार कृतियाँ कीजिए :'),
        _P('1', 'इ', 'निम्नलिखित अपठित गद्यांश पढ़कर दी गई सूचनाओं के अनुसार कृतियाँ कीजिए :'),
        _P('2', 'अ', 'निम्नलिखित पठित पद्यांश पढ़कर दी गई सूचनाओं के अनुसार कृतियाँ कीजिए :'),
        _P('2', 'आ', 'निम्नलिखित पठित पद्यांश पढ़कर दी गई सूचनाओं के अनुसार कृतियाँ कीजिए :'),
        _P('3', 'अ', 'निम्नलिखित पठित गद्यांश पढ़कर दी गई सूचनाओं के अनुसार कृतियाँ कीजिए :'),
        _P('3', 'आ', 'निम्नलिखित पठित पद्यांश पढ़कर दी गई सूचनाओं के अनुसार कृतियाँ कीजिए :'),
        _Q('4', '', 'सूचनाओं के अनुसार कृतियाँ कीजिए :', 1, 14),
        _P('5', 'अ (1)', 'पत्रलेखन :'),
        _Q('5', 'अ (2)', 'गद्य आकलन - प्रश्न निर्मिति :', 4, 1),
        _P('5', 'आ (1)', 'वृत्तांत लेखन / कहानी लेखन :'),
        _P('5', 'आ (2)', 'विज्ञापन लेखन :'),
        _P('5', 'इ', 'निबंध लेखन :'),
      ],
      header: {
        subjectLine: 'HINDI (15) (SECOND OR THIRD LANGUAGE)',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 3 Hours',
        notes: [
          'सूचनाओं के अनुसार गद्य, पद्य, पूरक पठन तथा भाषा अध्ययन (व्याकरण) की आकलन कृतियों में आवश्यकता के अनुसार आकृतियों में ही उत्तर लिखना अपेक्षित है।',
          'सभी आकृतियों के लिए पेन/पेन्सिल का ही प्रयोग करें।',
          'रचना विभाग में पूछे गए प्रश्नों के उत्तर लिखने के लिए आकृतियों की आवश्यकता नहीं है।',
          'शुद्ध, स्पष्ट एवं सुवाच्य लेखन अपेक्षित है।',
        ],
      },
    },
    ssc_geometry_40: {
      board: 'SSC',
      subject: 'Mathematics - Geometry Part II - 40 marks',
      label: 'SSC Geometry Part II - 40 marks',
      sections: [
        _Q('1', 'A', 'For each of the following sub-question four alternative answers are given. Choose the correct alternative and write its alphabet :', 1, 4),
        _Q('1', 'B', 'Solve the following sub-questions :', 1, 4),
        _Q('2', 'A', 'Complete the following activities and rewrite it (any two) :', 2, 2),
        _Q('2', 'B', 'Solve the following sub-questions (any four) :', 2, 4),
        _Q('3', 'A', 'Complete the following activities and rewrite it (any one) :', 3, 1),
        _Q('3', 'B', 'Solve the following sub-questions (any two) :', 3, 2),
        _Q('4', '', 'Solve the following sub-questions (any two) :', 4, 2),
        _Q('5', '', 'Solve the following sub-questions (any one) :', 3, 1),
      ],
      header: {
        subjectLine: 'MATHEMATICS (71) GEOMETRY - PART II',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 2 Hours',
        notes: [
          'All questions are compulsory.',
          'Use of a calculator is not allowed.',
          'The numbers to the right of the questions indicate full marks.',
          'In case of MCQs [Q. No. 1(A)] only the first attempt will be evaluated and will be given credit.',
          'Draw proper figures wherever necessary.',
          'The marks of construction should be clear. Do not erase them.',
          'Diagram is essential for writing the proof of the theorem.',
        ],
      },
    },
    ssc_science1_40: {
      board: 'SSC',
      subject: 'Science & Technology Part I - 40 marks',
      label: 'SSC Science Part I - 40 marks',
      sections: [
        _Q('1', 'A', 'Choose the correct alternative :', 1, 5),
        _Q('1', 'B', 'Solve the following questions :', 1, 5),
        _Q('2', 'A', 'Give scientific reasons (any two) :', 2, 2),
        _Q('2', 'B', 'Solve the following subquestions (any three) :', 2, 3),
        _Q('3', '', 'Solve the following questions (any five) :', 3, 5),
        _Q('4', '', 'Answer the following questions (any one) :', 5, 1),
      ],
      header: {
        subjectLine: 'SCIENCE AND TECHNOLOGY (72) - PART I',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 2 Hours',
        notes: [
          'All questions are compulsory.',
          'Use of a calculator is not allowed.',
          'The numbers to the right of the questions indicate full marks.',
          'In case of MCQs [Q. No. 1(A)] only the first attempt will be evaluated and will be given credit.',
          'Scientifically correct, labelled diagrams should be drawn wherever necessary.',
        ],
      },
    },
    ssc_science2_40: {
      board: 'SSC',
      subject: 'Science & Technology Part II - 40 marks',
      label: 'SSC Science Part II - 40 marks',
      sections: [
        _Q('1', 'A', 'Choose the correct alternative :', 1, 5),
        _Q('1', 'B', 'Answer the following questions :', 1, 5),
        _Q('2', 'A', 'Give scientific reasons (any two) :', 2, 2),
        _Q('2', 'B', 'Answer the following questions (any three) :', 2, 3),
        _Q('3', '', 'Answer the following questions (any five) :', 3, 5),
        _Q('4', '', 'Answer the following questions (any one) :', 5, 1),
      ],
      header: {
        subjectLine: 'SCIENCE AND TECHNOLOGY (72) - PART II',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 2 Hours',
        notes: [
          'All questions are compulsory.',
          'The numbers to the right of the questions indicate full marks.',
          'In case of MCQs [Q. No. 1 (A)] only the first attempt will be evaluated and will be given credit.',
          'Scientifically and technically correct, labelled diagrams should be drawn wherever necessary.',
          'Each new question should be started on the new page.',
        ],
      },
    },
    ssc_history_40: {
      board: 'SSC',
      subject: 'History & Political Science (Paper I) - 40 marks',
      label: 'SSC History & Political Science - 40 marks',
      sections: [
        _Q('1', 'A', 'Choose the correct option from the given options and complete the sentences :', 1, 3),
        _Q('1', 'B', 'Identify and write the wrong pair in the following sets :', 1, 3),
        _Q('2', 'A', 'Do as directed (any two) :', 2, 2),
        _Q('2', 'B', 'Write short notes (any two) :', 2, 2),
        _Q('3', '', 'Explain the following statements with reasons (any two) :', 2, 2),
        _P('4', '', 'Read the following passage and answer the questions based on it :'),
        _Q('5', '', 'Answer the following questions in detail (any two) :', 3, 2),
        _Q('6', '', 'Choose the correct option from the given options and complete the statements :', 1, 2),
        _Q('7', '', 'State whether the following statements are true or false. Give reasons for your answers (any two) :', 2, 2),
        _Q('8', 'A', 'Explain the following concepts (any one) :', 2, 1),
        _Q('8', 'B', 'Do as directed (any one) :', 2, 1),
        _Q('9', '', 'Answer the following questions in brief (any one) :', 2, 1),
      ],
      header: {
        subjectLine: 'SOCIAL SCIENCES (73) HISTORY & POLITICAL SCIENCE - PAPER I',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 2 Hours',
        notes: [
          'All activities/questions are compulsory.',
          'Figures to the right indicate full marks.',
          'Question Nos. 1 to 5 are based on History and Question Nos. 6 to 9 are based on Political Science.',
          'In question numbers 2(A) and 8(B), the appropriate answers are expected to be written in the concept map with pen/pencil.',
          'If the answers of question numbers 1(A), 1(B) and question number 6 are repeated in the answer sheet, then the first attempted answers only will be considered.',
        ],
      },
    },
    ssc_geography_40: {
      board: 'SSC',
      subject: 'Geography (Paper II) - 40 marks',
      label: 'SSC Geography - 40 marks',
      sections: [
        _Q('1', '', 'Choose the correct alternative and complete the sentences :', 1, 4),
        _Q('2', '', 'Identify the odd factor out :', 1, 4),
        _Q('3', '', 'State whether the sentences are right or wrong (any four) :', 1, 4),
        _Q('4', 'A', 'Mark the following in the outline map of Brazil and give index (any four) :', 1, 4),
        _Q('4', 'B', 'Observe the map of India and answer the following questions (any four) :', 1, 4),
        _Q('5', '', 'Give geographical reasons (any two) :', 3, 2),
        _Q('6', 'A / B', 'Prepare a simple line graph from the given data and answer the questions - OR - Read the graph and answer the questions :', 6, 1),
        _Q('7', '', 'Answer in detail (any two) :', 4, 2),
      ],
      header: {
        subjectLine: 'SOCIAL SCIENCES (73) GEOGRAPHY - PAPER II',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 2 Hours',
        notes: [
          'All questions/activities are compulsory.',
          'Figures to the right indicate full marks.',
          'For Q. No. 4(A) use supplied outline map of Brazil and tie it to your answer-book.',
          'For Q. No. 6(A) use the graph paper supplied to you and attach it to the main answer-book.',
          'Use of stencil is allowed for drawing map.',
          'Draw neat diagrams and sketches wherever necessary.',
        ],
      },
    },
    ssc_algebra_40: {
      board: 'SSC',
      subject: 'Mathematics - Algebra Part I - 40 marks',
      label: 'SSC Algebra Part I - 40 marks',
      sections: [
        { qNo: '1', part: 'A', instruction: 'Choose the correct alternative from given :', marksEach: 1, attempt: 4 },
        { qNo: '1', part: 'B', instruction: 'Solve the following subquestions :', marksEach: 1, attempt: 4 },
        { qNo: '2', part: 'A', instruction: 'Complete the following activities and rewrite it (any two) :', marksEach: 2, attempt: 2 },
        { qNo: '2', part: 'B', instruction: 'Solve the following subquestions (any four) :', marksEach: 2, attempt: 4 },
        { qNo: '3', part: 'A', instruction: 'Complete the following activity and rewrite it (any one) :', marksEach: 3, attempt: 1 },
        { qNo: '3', part: 'B', instruction: 'Solve the following subquestions (any two) :', marksEach: 3, attempt: 2 },
        { qNo: '4', part: '', instruction: 'Solve the following subquestions (any two) :', marksEach: 4, attempt: 2 },
        { qNo: '5', part: '', instruction: 'Solve the following subquestions (any one) :', marksEach: 3, attempt: 1 },
      ],
      header: {
        subjectLine: 'ALGEBRA - PART I',
        courseLine: '(REVISED COURSE)',
        timeText: 'Time : 2 Hours',
        notes: [
          'All questions are compulsory.',
          'Use of a calculator is not allowed.',
          'The numbers to the right of the questions indicate full marks.',
          'In case of MCQs [Q. No. 1(A)] only the first attempt will be evaluated and will be given credit.',
        ],
      },
    },
  };

  // Marathi-medium versions of the same patterns: identical sections (marks/attempt), only the printed
  // instruction lines + header/notes are Marathi. Questions themselves always come from the bank in
  // whatever language they were saved. `instructions[i]` lines up with TEMPLATES[key].sections[i].
  // Wording follows the usual Maharashtra board Marathi-medium papers — worth a quick read against a real one.
  const _MR_MATH_INSTR = [
    'खालील प्रत्येक उपप्रश्नासाठी चार पर्याय दिले आहेत. त्यांपैकी अचूक पर्याय निवडून त्याचे वर्णाक्षर लिहा :',
    'खालील उपप्रश्न सोडवा :',
    'खालील कृती पूर्ण करून पुन्हा लिहा (कोणत्याही दोन) :',
    'खालील उपप्रश्न सोडवा (कोणतेही चार) :',
    'खालील कृती पूर्ण करून पुन्हा लिहा (कोणतीही एक) :',
    'खालील उपप्रश्न सोडवा (कोणतेही दोन) :',
    'खालील उपप्रश्न सोडवा (कोणतेही दोन) :',
    'खालील उपप्रश्न सोडवा (कोणताही एक) :',
  ];
  const _MR_MATH_NOTES = [
    'सर्व प्रश्न सोडवणे अनिवार्य आहे.',
    'कॅलक्युलेटरचा वापर करण्यास परवानगी नाही.',
    'प्रश्नांच्या उजवीकडे दर्शवलेले अंक पूर्ण गुण दर्शवतात.',
    'बहुपर्यायी प्रश्नांमध्ये [प्र. क्र. १(अ)] फक्त पहिलाच प्रयत्न ग्राह्य धरून गुण दिले जातील.',
  ];
  const _MR_SCI_NOTES = [
    'सर्व प्रश्न सोडवणे अनिवार्य आहे.',
    'कॅलक्युलेटरचा वापर करण्यास परवानगी नाही.',
    'प्रश्नांच्या उजवीकडे दर्शवलेले अंक पूर्ण गुण दर्शवतात.',
    'बहुपर्यायी प्रश्नांमध्ये [प्र. क्र. १(अ)] फक्त पहिलाच प्रयत्न ग्राह्य धरून गुण दिले जातील.',
    'आवश्यक तेथे शास्त्रीयदृष्ट्या अचूक, नामनिर्देशित आकृत्या काढाव्यात.',
  ];
  const _MR_HDR = (subjectLine, hours, notes) => ({ subjectLine, courseLine: '(सुधारित अभ्यासक्रम)', timeText: `वेळ : ${hours} तास`, notes });
  const _MR = {
    ssc_algebra_40: {
      subject: 'गणित - बीजगणित भाग १ - ४० गुण',
      instructions: _MR_MATH_INSTR,
      header: _MR_HDR('गणित (७१) बीजगणित - भाग १', '२', _MR_MATH_NOTES),
    },
    ssc_geometry_40: {
      subject: 'गणित - भूमिती भाग २ - ४० गुण',
      instructions: _MR_MATH_INSTR,
      header: _MR_HDR('गणित (७१) भूमिती - भाग २', '२', [
        ..._MR_MATH_NOTES,
        'आवश्यक तेथे आकृत्या योग्य रीतीने काढा.',
        'रचनेच्या खुणा स्पष्ट दिसाव्यात. त्या पुसू नयेत.',
        'प्रमेयाची उपपत्ती लिहिताना आकृती आवश्यक आहे.',
      ]),
    },
    ssc_science1_40: {
      subject: 'विज्ञान व तंत्रज्ञान भाग १ - ४० गुण',
      instructions: [
        'योग्य पर्याय निवडून विधाने पूर्ण करा :',
        'खालील प्रश्न सोडवा :',
        'शास्त्रीय कारणे लिहा (कोणतेही दोन) :',
        'खालील उपप्रश्न सोडवा (कोणतेही तीन) :',
        'खालील प्रश्न सोडवा (कोणतेही पाच) :',
        'खालील प्रश्नांची उत्तरे लिहा (कोणताही एक) :',
      ],
      header: _MR_HDR('विज्ञान आणि तंत्रज्ञान (७२) - भाग १', '२', _MR_SCI_NOTES),
    },
    ssc_science2_40: {
      subject: 'विज्ञान व तंत्रज्ञान भाग २ - ४० गुण',
      instructions: [
        'योग्य पर्याय निवडून विधाने पूर्ण करा :',
        'खालील प्रश्नांची उत्तरे लिहा :',
        'शास्त्रीय कारणे लिहा (कोणतेही दोन) :',
        'खालील प्रश्नांची उत्तरे लिहा (कोणतेही तीन) :',
        'खालील प्रश्नांची उत्तरे लिहा (कोणतेही पाच) :',
        'खालील प्रश्नांची उत्तरे लिहा (कोणताही एक) :',
      ],
      header: _MR_HDR('विज्ञान आणि तंत्रज्ञान (७२) - भाग २', '२', [
        'सर्व प्रश्न सोडवणे अनिवार्य आहे.',
        'प्रश्नांच्या उजवीकडे दर्शवलेले अंक पूर्ण गुण दर्शवतात.',
        'बहुपर्यायी प्रश्नांमध्ये [प्र. क्र. १(अ)] फक्त पहिलाच प्रयत्न ग्राह्य धरून गुण दिले जातील.',
        'आवश्यक तेथे शास्त्रीयदृष्ट्या व तांत्रिकदृष्ट्या अचूक, नामनिर्देशित आकृत्या काढाव्यात.',
        'प्रत्येक नवीन प्रश्न नवीन पानावर सुरू करावा.',
      ]),
    },
    ssc_history_40: {
      subject: 'इतिहास व राज्यशास्त्र (पेपर १) - ४० गुण',
      instructions: [
        'दिलेल्या पर्यायांतून योग्य पर्याय निवडून वाक्ये पूर्ण करा :',
        'खालील संचांतील चुकीची जोडी ओळखून लिहा :',
        'सूचनेप्रमाणे कृती करा (कोणत्याही दोन) :',
        'टीपा लिहा (कोणत्याही दोन) :',
        'खालील विधानांचे कारणांसह स्पष्टीकरण करा (कोणतीही दोन) :',
        'खालील उतारा वाचा व त्यावर आधारित प्रश्नांची उत्तरे लिहा :',
        'सविस्तर उत्तरे लिहा (कोणतेही दोन) :',
        'दिलेल्या पर्यायांतून योग्य पर्याय निवडून विधाने पूर्ण करा :',
        'खालील विधाने सत्य की असत्य ते कारणासह लिहा (कोणतीही दोन) :',
        'खालील संकल्पना स्पष्ट करा (कोणतीही एक) :',
        'सूचनेप्रमाणे कृती करा (कोणतीही एक) :',
        'थोडक्यात उत्तरे लिहा (कोणताही एक) :',
      ],
      header: _MR_HDR('समाजविज्ञान (७३) इतिहास व राज्यशास्त्र - पेपर १', '२', [
        'सर्व कृती/प्रश्न सोडवणे अनिवार्य आहे.',
        'उजवीकडील अंक पूर्ण गुण दर्शवतात.',
        'प्रश्न क्र. १ ते ५ इतिहासावर आणि प्रश्न क्र. ६ ते ९ राज्यशास्त्रावर आधारित आहेत.',
        'प्रश्न क्र. २(अ) व ८(ब) मध्ये योग्य उत्तरे संकल्पना चित्रात पेन/पेन्सिलने लिहावीत.',
        'प्रश्न क्र. १(अ), १(ब) व ६ ची उत्तरे उत्तरपत्रिकेत पुन्हा लिहिल्यास पहिले उत्तरच ग्राह्य धरले जाईल.',
      ]),
    },
    ssc_geography_40: {
      subject: 'भूगोल (पेपर २) - ४० गुण',
      instructions: [
        'योग्य पर्याय निवडून वाक्ये पूर्ण करा :',
        'गटात न बसणारा घटक ओळखा :',
        'खालील वाक्ये बरोबर की चूक ते लिहा (कोणतीही चार) :',
        'ब्राझीलच्या outline नकाशात खालील गोष्टी दाखवा व सूची द्या (कोणत्याही चार) :',
        'भारताच्या नकाशाचे निरीक्षण करून खालील प्रश्नांची उत्तरे लिहा (कोणतेही चार) :',
        'भौगोलिक कारणे लिहा (कोणतीही दोन) :',
        'दिलेल्या सांख्यिकीय माहितीच्या आधारे साधा रेषा आलेख तयार करून प्रश्नांची उत्तरे लिहा - किंवा - आलेख वाचून प्रश्नांची उत्तरे लिहा :',
        'सविस्तर उत्तरे लिहा (कोणतीही दोन) :',
      ],
      header: _MR_HDR('समाजविज्ञान (७३) भूगोल - पेपर २', '२', [
        'सर्व प्रश्न/कृती सोडवणे अनिवार्य आहे.',
        'उजवीकडील अंक पूर्ण गुण दर्शवतात.',
        'प्र. क्र. ४(अ) साठी पुरवलेला ब्राझीलचा outline नकाशा उत्तरपुस्तिकेला जोडावा.',
        'प्र. क्र. ६(अ) साठी पुरवलेला आलेखकागद मुख्य उत्तरपुस्तिकेला जोडावा.',
        'नकाशा काढण्यासाठी स्टेन्सिल वापरण्यास परवानगी आहे.',
        'आवश्यक तेथे आकृत्या/रेखाचित्रे नीटनेटकी काढावीत.',
      ]),
    },
  };
  Object.entries(_MR).forEach(([k, v]) => { if (TEMPLATES[k]) TEMPLATES[k].mr = v; });
  // Marathi/Hindi language papers are already in their own language — offered under either medium.
  ['ssc_marathi_80', 'ssc_hindi_80'].forEach(k => { if (TEMPLATES[k]) TEMPLATES[k].native = true; });

  const DEFAULT_HEADER = () => ({
    paperCode: '',
    examLine: '',
    subjectLine: '',
    courseLine: '',
    timeText: 'Time : 2 Hours',
    notes: ['All questions are compulsory.', 'The numbers to the right of the questions indicate full marks.'],
    seatOnEveryPage: true,
    mcqLayout: 'list',
  });

  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const _tplBoards = () => [...new Set(Object.values(TEMPLATES).map(t => t.board).filter(Boolean))];
  let _idCounter = 0;
  const _newId = () => `s${Date.now().toString(36)}${(_idCounter++).toString(36)}`;

  let _styled = false;
  function _injectStyle() {
    if (_styled) return;
    _styled = true;
    const st = document.createElement('style');
    st.textContent = `
      .pps-box { border: 1px solid rgba(128,128,128,.4); border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
      .pps-toggle { display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer; }
      .pps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 8px 0; }
      .pps-grid label, .pps-lbl { display: flex; flex-direction: column; font-size: 0.74rem; opacity: .85; gap: 3px; }
      .pps-in { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128,128,128,.45); background: rgba(128,128,128,.08); color: inherit; font: inherit; font-size: 0.85rem; }
      .pps-sec { border: 1px solid rgba(128,128,128,.35); border-radius: 8px; padding: 8px; margin: 8px 0; }
      .pps-sec.active { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,.25); }
      .pps-sec-passage { background: rgba(59,130,246,.06); }
      .pps-sec-row { display: grid; grid-template-columns: 52px 46px 1fr; gap: 6px; align-items: end; }
      .pps-sec-row2 { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; font-size: 0.8rem; }
      .pps-sec-row2 .pps-in { width: 70px; }
      .pps-chip { padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(128,128,128,.4); font-size: 0.74rem; }
      .pps-chip.ok { background: rgba(16,185,129,.15); border-color: rgba(16,185,129,.5); }
      .pps-chip.bad { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.5); }
      .pps-btn { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(128,128,128,.5); background: transparent; color: inherit; cursor: pointer; font-size: 0.8rem; }
      .pps-btn.pri { background: #f97316; border-color: #f97316; color: #fff; font-weight: 700; }
      .pps-sum { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 6px; }
      .pps-sum th, .pps-sum td { padding: 3px 6px; border-bottom: 1px solid rgba(128,128,128,.25); text-align: right; }
      .pps-sum th:first-child, .pps-sum td:first-child { text-align: left; }
      .pps-total { margin-top: 8px; padding: 6px 10px; border-radius: 8px; font-weight: 700; display: flex; justify-content: space-between; }
      .pps-total.ok { background: rgba(16,185,129,.15); }
      .pps-total.bad { background: rgba(239,68,68,.15); }
      .pps-issue { font-size: 0.78rem; color: #ef4444; margin: 3px 0; }
      .pps-hint { font-size: 0.76rem; opacity: .75; margin: 4px 0; }
      .pps-mcq { border: 1px solid rgba(128,128,128,.35); border-radius: 10px; padding: 8px; margin-top: 8px; }
      .pps-mcq-list { max-height: 320px; overflow-y: auto; margin-top: 6px; }
      .pps-mcq-item { display: flex; gap: 8px; align-items: flex-start; justify-content: space-between; padding: 8px; border-bottom: 1px solid rgba(128,128,128,.25); font-size: 0.85rem; }
      .pps-mcq-item ul { list-style: none; margin: 4px 0 0; padding: 0; opacity: .85; }
      .pps-mcq-item li.ok { color: #16a34a; font-weight: 700; }
      .pps-list-head { font-weight: 700; font-size: 0.85rem; margin: 10px 0 4px; padding: 4px 8px; border-left: 3px solid #f97316; background: rgba(249,115,22,.08); }
      .pps-move { max-width: 110px; font-size: 0.75rem; padding: 2px 4px; border-radius: 6px; border: 1px solid rgba(128,128,128,.45); background: transparent; color: inherit; }
    `;
    document.head.appendChild(st);
  }

  // An MCQ-bank question, shaped like a paper question (options printed one per line).
  function _mcqToQ(m) {
    const opts = m.options || {};
    const lines = ['A', 'B', 'C', 'D'].filter(k => opts[k]).map(k => `(${k}) ${opts[k]}`);
    const ans = String(m.answer || '').trim().toUpperCase();
    return {
      _id: `mcq:${m._id}`, mcqId: m._id, isMcq: true, marks: 1, usageCount: 0,
      questionText: { english: [m.question, ...lines].join('\n') },
      answerText: { english: opts[ans] ? `(${ans}) ${opts[ans]}` : ans },
    };
  }
  const _isMcqSection = s => /alternative|choose the correct|\bmcq\b|पर्याय/i.test(String(s.instruction || ''));

  function create({ getSelected, onChange, fetchByMarks, fetchMcq, fetchPassageBlocks, addQuestion, canFill, canFillPassage, toast } = {}) {
    const state = { enabled: false, sections: [], activeId: null, header: DEFAULT_HEADER() };
    let root = null;
    const selected = () => (typeof getSelected === 'function' ? getSelected() : []) || [];
    const notify = () => { try { onChange?.(); } catch (e) { console.warn('paper sections onChange', e); } };

    function sectionMarks(s) { return (Number(s.attempt) || 0) * (Number(s.marksEach) || 0); }
    function label(s) { return `Q.${s.qNo || '?'}${s.part ? ` (${s.part})` : ''}`; }
    const isPassage = s => s.kind === 'passage';

    function summary() {
      const counts = new Map(state.sections.filter(s => !isPassage(s)).map(s => [s.id, 0]));
      let unassigned = 0;
      const mismatched = [];
      for (const q of selected()) {
        if (counts.has(q.sectionId)) {
          counts.set(q.sectionId, counts.get(q.sectionId) + 1);
          const sec = state.sections.find(s => s.id === q.sectionId);
          if (sec && Number(q.marks) !== Number(sec.marksEach)) mismatched.push({ section: label(sec), marks: q.marks, expected: sec.marksEach });
        } else unassigned++;
      }
      const rows = state.sections.map(s => isPassage(s)
        ? { id: s.id, label: label(s), count: s.passageBlockId ? 1 : 0, attempt: 1, marks: sectionMarks(s), short: !s.passageBlockId, isPassage: true, blockTitle: s._blockTitle || '' }
        : { id: s.id, label: label(s), count: counts.get(s.id), attempt: Number(s.attempt) || 0, marks: sectionMarks(s), short: counts.get(s.id) < (Number(s.attempt) || 0) });
      const issues = [];
      if (!state.sections.length) issues.push('Add at least one section.');
      rows.filter(r => r.short).forEach(r => issues.push(r.isPassage
        ? `${r.label}: choose a passage block.`
        : `${r.label}: attempt ${r.attempt} but only ${r.count} question${r.count === 1 ? '' : 's'} added.`));
      if (unassigned) issues.push(`${unassigned} question${unassigned === 1 ? ' is' : 's are'} not in any section.`);
      state.sections.forEach(s => {
        if (isPassage(s)) return;
        if (!(Number(s.marksEach) > 0)) issues.push(`${label(s)}: marks per question must be above 0.`);
        if (!(Number(s.attempt) >= 1)) issues.push(`${label(s)}: attempt must be at least 1.`);
      });
      return { rows, total: rows.reduce((t, r) => t + r.marks, 0), unassigned, mismatched, issues };
    }

    // withSnapshots: for the unsaved-draft Preview only — a passage section also carries its block's
    // content + marks (the server does this itself on save, so it is never sent then).
    function payload(opts = {}) {
      if (!state.enabled) return {};
      return {
        layout: 'board',
        sections: state.sections.map(s => isPassage(s)
          ? { id: s.id, qNo: s.qNo, part: s.part, instruction: s.instruction, passageBlockId: s.passageBlockId || '',
              ...(opts.withSnapshots ? { marksEach: Number(s.marksEach) || 0, attempt: 1, passageSnapshot: s._block || null } : {}) }
          : { id: s.id, qNo: s.qNo, part: s.part, instruction: s.instruction, marksEach: Number(s.marksEach), attempt: Number(s.attempt) }),
        header: { ...state.header, notes: [...state.header.notes] },
      };
    }

    // ── rendering ────────────────────────────────────────────────────────────
    function render() {
      if (!root) return;
      _injectStyle();
      if (!state.enabled) {
        root.innerHTML = `<div class="pps-box"><label class="pps-toggle"><input type="checkbox" data-pps="toggle" /> Board-style paper (sections, "attempt any N", header)</label></div>`;
        root.querySelector('[data-pps="toggle"]').addEventListener('change', e => { setEnabled(e.target.checked); });
        return;
      }
      const h = state.header;
      root.innerHTML = `
        <div class="pps-box">
          <label class="pps-toggle"><input type="checkbox" data-pps="toggle" checked /> Board-style paper (sections, "attempt any N", header)</label>
          <div class="pps-grid">
            <label>Paper code<input class="pps-in" data-h="paperCode" value="${_esc(h.paperCode)}" placeholder="e.g. N 919" /></label>
            <label>Exam line<input class="pps-in" data-h="examLine" value="${_esc(h.examLine)}" placeholder="e.g. 2026 III 06 1100 -N 919- MATHEMATICS (71)" /></label>
            <label>Subject line<input class="pps-in" data-h="subjectLine" value="${_esc(h.subjectLine)}" placeholder="e.g. ALGEBRA - PART I (E)" /></label>
            <label>Course line<input class="pps-in" data-h="courseLine" value="${_esc(h.courseLine)}" placeholder="(REVISED COURSE)" /></label>
            <label>Time<input class="pps-in" data-h="timeText" value="${_esc(h.timeText)}" placeholder="Time : 2 Hours" /></label>
          </div>
          <label class="pps-lbl">Notes at the top (one per line)
            <textarea class="pps-in" data-h="notes" rows="3">${_esc(h.notes.join('\n'))}</textarea></label>
          <label class="pps-toggle" style="font-weight:400;margin-top:6px"><input type="checkbox" data-h="seatOnEveryPage" ${h.seatOnEveryPage ? 'checked' : ''} /> Repeat the seat number box on every page</label>
        </div>
        <div class="pps-box">
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between">
            <strong>Sections</strong>
            <span>
              <select class="pps-move" data-pps="tplboard" title="Board">${_tplBoards().map(b => `<option value="${_esc(b)}">${_esc(b)}</option>`).join('')}</select>
              <select class="pps-move" data-pps="tplmedium" title="Medium"><option value="en">English medium</option><option value="mr">मराठी माध्यम</option></select>
              <select class="pps-move" data-pps="tplsubject" title="Template" style="max-width:240px"></select>
              <button type="button" class="pps-btn" data-pps="template">Load template</button>
              <button type="button" class="pps-btn" data-pps="mcq">+ MCQ from MCQ bank</button>
              <button type="button" class="pps-btn" data-pps="autofill">Auto-fill questions</button>
              <button type="button" class="pps-btn pri" data-pps="add">+ Add section</button>
              <button type="button" class="pps-btn pri" data-pps="addpassage">+ Add passage section</button>
            </span>
          </div>
          <p class="pps-hint">New questions go into the <b>active</b> section (highlighted). Pick a section, then add questions with the marks buttons.</p>
          <div data-pps="mcqpicker" class="pps-mcq" style="display:none"></div>
          <div data-pps="sections"></div>
        </div>
        <div class="pps-box" data-pps="summary"></div>`;

      root.querySelector('[data-pps="toggle"]').addEventListener('change', e => setEnabled(e.target.checked));
      root.querySelectorAll('[data-h]').forEach(el => {
        const key = el.dataset.h;
        const ev = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(ev, () => {
          if (key === 'notes') state.header.notes = el.value.split('\n').map(x => x.trim()).filter(Boolean);
          else if (key === 'seatOnEveryPage') state.header.seatOnEveryPage = el.checked;
          else state.header[key] = el.value;
          notify();
        });
      });
      root.querySelector('[data-pps="add"]').addEventListener('click', () => addSection());
      root.querySelector('[data-pps="addpassage"]').addEventListener('click', () => addSection({ kind: 'passage' }));
      root.querySelector('[data-pps="autofill"]').addEventListener('click', e => autoFill(e.currentTarget));
      root.querySelector('[data-pps="mcq"]').addEventListener('click', () => openMcqPicker());
      const boardSel = root.querySelector('[data-pps="tplboard"]');
      const tplSel = root.querySelector('[data-pps="tplsubject"]');
      const mediumSel = root.querySelector('[data-pps="tplmedium"]');
      const fillTpls = () => {
        const mr = mediumSel.value === 'mr';
        tplSel.innerHTML = Object.entries(TEMPLATES)
          .filter(([, t]) => t.board === boardSel.value && (!mr || t.mr || t.native))
          .map(([k, t]) => `<option value="${_esc(k)}">${_esc(mr && t.mr ? t.mr.subject : t.subject)}</option>`).join('');
      };
      boardSel.addEventListener('change', fillTpls);
      mediumSel.addEventListener('change', fillTpls);
      fillTpls();
      root.querySelector('[data-pps="template"]').addEventListener('click', () => { if (tplSel.value) loadTemplate(tplSel.value, mediumSel.value); });
      renderSections();
      renderSummary();
    }

    function renderSections() {
      const host = root?.querySelector('[data-pps="sections"]');
      if (!host) return;
      const sum = summary();
      const byId = new Map(sum.rows.map(r => [r.id, r]));
      host.innerHTML = state.sections.length ? state.sections.map(s => {
        const r = byId.get(s.id);
        if (isPassage(s)) {
          return `
          <div class="pps-sec pps-sec-passage ${s.id === state.activeId ? 'active' : ''}" data-sec="${s.id}">
            <div class="pps-sec-row">
              <label>Q. no<input class="pps-in" data-f="qNo" value="${_esc(s.qNo)}" /></label>
              <label>Part<input class="pps-in" data-f="part" value="${_esc(s.part)}" placeholder="A" /></label>
              <label>Instruction<input class="pps-in" data-f="instruction" value="${_esc(s.instruction)}" placeholder="e.g. Read the following passage and do the activities :" /></label>
            </div>
            <div class="pps-sec-row2">
              ${s.passageBlockId
                ? `<span class="pps-chip ok">${_esc(s._blockTitle || 'Passage chosen')}</span><span class="pps-chip" data-role="marks">= ${r.marks} marks</span><button type="button" class="pps-btn" data-act="choose">Change block</button>`
                : `<span class="pps-chip bad" data-role="count">No passage block chosen</span><button type="button" class="pps-btn pri" data-act="choose">Choose passage block</button>`}
              <button type="button" class="pps-btn" data-act="up">Up</button>
              <button type="button" class="pps-btn" data-act="down">Down</button>
              <button type="button" class="pps-btn" data-act="remove">Remove</button>
            </div>
          </div>`;
        }
        return `
          <div class="pps-sec ${s.id === state.activeId ? 'active' : ''}" data-sec="${s.id}">
            <div class="pps-sec-row">
              <label>Q. no<input class="pps-in" data-f="qNo" value="${_esc(s.qNo)}" /></label>
              <label>Part<input class="pps-in" data-f="part" value="${_esc(s.part)}" placeholder="A" /></label>
              <label>Instruction<input class="pps-in" data-f="instruction" value="${_esc(s.instruction)}" placeholder="e.g. Solve the following subquestions :" /></label>
            </div>
            <div class="pps-sec-row2">
              <label>Marks each <input class="pps-in" type="number" min="1" step="1" data-f="marksEach" value="${_esc(s.marksEach)}" /></label>
              <label>Attempt <input class="pps-in" type="number" min="1" step="1" data-f="attempt" value="${_esc(s.attempt)}" /></label>
              <span class="pps-chip ${r.short ? 'bad' : 'ok'}" data-role="count">${r.count} question${r.count === 1 ? '' : 's'} added</span>
              <span class="pps-chip" data-role="marks">= ${r.marks} marks</span>
              <button type="button" class="pps-btn" data-act="active">${s.id === state.activeId ? 'Active' : 'Use this section'}</button>
              <button type="button" class="pps-btn" data-act="up">Up</button>
              <button type="button" class="pps-btn" data-act="down">Down</button>
              <button type="button" class="pps-btn" data-act="remove">Remove</button>
            </div>
          </div>`;
      }).join('') : '<p class="pps-hint">No sections yet - add one, or load the template.</p>';

      host.querySelectorAll('[data-sec]').forEach(card => {
        const sec = state.sections.find(x => x.id === card.dataset.sec);
        card.querySelectorAll('[data-f]').forEach(inp => {
          inp.addEventListener('input', () => {
            const f = inp.dataset.f;
            sec[f] = (f === 'marksEach' || f === 'attempt') ? Number(inp.value) : inp.value;
            refreshLive();
            notify();
          });
        });
        card.querySelectorAll('[data-act]').forEach(btn => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            const i = state.sections.findIndex(x => x.id === sec.id);
            if (act === 'active') state.activeId = sec.id;
            if (act === 'choose') { state.activeId = sec.id; openPassageBlockPicker(sec.id); return; }
            if (act === 'remove') {
              state.sections.splice(i, 1);
              selected().forEach(q => { if (q.sectionId === sec.id) q.sectionId = undefined; });
              if (state.activeId === sec.id) state.activeId = state.sections[0]?.id || null;
            }
            if (act === 'up' && i > 0) [state.sections[i - 1], state.sections[i]] = [state.sections[i], state.sections[i - 1]];
            if (act === 'down' && i < state.sections.length - 1) [state.sections[i + 1], state.sections[i]] = [state.sections[i], state.sections[i + 1]];
            renderSections();
            renderSummary();
            notify();
          });
        });
      });
    }

    // Update chips/summary without rebuilding the inputs (keeps typing focus).
    function refreshLive() {
      const sum = summary();
      root?.querySelectorAll('[data-sec]').forEach(card => {
        const r = sum.rows.find(x => x.id === card.dataset.sec);
        if (!r) return;
        const c = card.querySelector('[data-role="count"]');
        const m = card.querySelector('[data-role="marks"]');
        if (c) { c.textContent = `${r.count} question${r.count === 1 ? '' : 's'} added`; c.className = `pps-chip ${r.short ? 'bad' : 'ok'}`; }
        if (m) m.textContent = `= ${r.marks} marks`;
      });
      renderSummary(sum);
    }

    function renderSummary(sumIn) {
      const host = root?.querySelector('[data-pps="summary"]');
      if (!host) return;
      const sum = sumIn || summary();
      const ok = !sum.issues.length;
      host.innerHTML = `
        <strong>Marks check</strong>
        <table class="pps-sum"><tr><th>Section</th><th>Added</th><th>Attempt</th><th>Marks</th></tr>
          ${sum.rows.map(r => `<tr><td>${_esc(r.label)}</td><td>${r.count}</td><td>${r.attempt}</td><td>${r.marks}</td></tr>`).join('')}
        </table>
        <div class="pps-total ${ok ? 'ok' : 'bad'}"><span>Paper total</span><span>${sum.total} marks ${ok ? '&#10003;' : ''}</span></div>
        ${sum.issues.map(i => `<div class="pps-issue">${_esc(i)}</div>`).join('')}
        ${sum.mismatched.length ? `<div class="pps-hint">Note: ${sum.mismatched.length} question(s) have a different mark value than their section (marks are counted from the section).</div>` : ''}`;
    }

    // ── state changes ────────────────────────────────────────────────────────
    function setEnabled(on) {
      state.enabled = !!on;
      if (on && !state.sections.length) addSection({ silent: true });
      if (!on) selected().forEach(q => { q.sectionId = undefined; });
      render();
      notify();
    }

    function addSection({ silent, kind } = {}) {
      const last = state.sections[state.sections.length - 1];
      const nextQ = last ? String((parseInt(last.qNo, 10) || state.sections.length) + 1) : '1';
      const sec = kind === 'passage'
        ? { id: _newId(), kind: 'passage', qNo: nextQ, part: '', instruction: 'Read the following passage and do the activities :', passageBlockId: '', marksEach: 0, attempt: 1 }
        : { id: _newId(), qNo: nextQ, part: '', instruction: '', marksEach: 1, attempt: 1 };
      state.sections.push(sec);
      state.activeId = sec.id;
      if (!silent) { renderSections(); renderSummary(); notify(); }
    }

    function loadTemplate(key, medium = 'en') {
      const t = TEMPLATES[key];
      if (!t) return;
      const mr = medium === 'mr' && t.mr ? t.mr : null; // same sections, only the printed text switches
      state.sections = t.sections.map((s, i) => ({ id: _newId(), ...s, ...(mr && mr.instructions[i] ? { instruction: mr.instructions[i] } : {}) }));
      state.activeId = state.sections[0].id;
      const hdr = mr ? mr.header : t.header;
      state.header = { ...DEFAULT_HEADER(), ...state.header, ...hdr, notes: [...hdr.notes] };
      selected().forEach(q => { q.sectionId = undefined; });
      render();
      notify();
    }

    // Picker for MCQ-bank questions; a chosen one goes into the active section.
    async function openMcqPicker() {
      const host = root?.querySelector('[data-pps="mcqpicker"]');
      const say = (m, kind) => { try { toast?.(m, kind); } catch { /* ignore */ } };
      if (!host || typeof fetchMcq !== 'function') return;
      if (typeof canFill === 'function' && !canFill()) { say('Select the batch, subject and chapters first', 'error'); return; }
      if (!state.sections.length) { say('Add a section first, then add questions', 'error'); return; }
      host.style.display = '';
      host.innerHTML = '<p class="pps-hint">Loading MCQs...</p>';
      let rows = [];
      try { rows = (await fetchMcq()).filter(m => (m.type || 'mcq') === 'mcq'); } catch (e) { host.innerHTML = '<p class="pps-hint">Could not load MCQs.</p>'; return; }
      const paint = term => {
        const t = String(term || '').toLowerCase();
        const shown = rows.filter(m => !t || String(m.question || '').toLowerCase().includes(t)).slice(0, 100);
        host.querySelector('.pps-mcq-list').innerHTML = shown.length ? shown.map(m => {
          const added = selected().some(q => q._id === `mcq:${m._id}`);
          const opts = m.options || {};
          return `<div class="pps-mcq-item"><div><div>${_esc(m.question)}</div><ul>${['A', 'B', 'C', 'D'].filter(k => opts[k]).map(k => `<li class="${String(m.answer).toUpperCase() === k ? 'ok' : ''}">(${k}) ${_esc(opts[k])}</li>`).join('')}</ul></div><button type="button" class="pps-btn" data-mid="${_esc(m._id)}" ${added ? 'disabled' : ''}>${added ? 'Added' : '+ Add'}</button></div>`;
        }).join('') : '<p class="pps-hint">No MCQs found for the selected chapters.</p>';
        host.querySelectorAll('[data-mid]').forEach(b => b.addEventListener('click', () => {
          const m = rows.find(x => String(x._id) === b.dataset.mid);
          if (!m) return;
          addQuestion(_mcqToQ(m));
          b.disabled = true; b.textContent = 'Added';
        }));
        window.PAPER_PDF?.ensureKatex?.().then(() => window.PAPER_PDF.renderMath(host)).catch(() => {});
      };
      host.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>MCQ bank (${rows.length}) - adds to the active section</strong><button type="button" class="pps-btn" data-x="close">Close</button></div><input class="pps-in" data-x="search" placeholder="Search MCQs..." style="width:100%;margin-top:6px" /><div class="pps-mcq-list"></div>`;
      host.querySelector('[data-x="close"]').addEventListener('click', () => { host.style.display = 'none'; });
      host.querySelector('[data-x="search"]').addEventListener('input', e => paint(e.target.value));
      paint('');
    }

    // Fill every section up to its "attempt" count from the chosen chapters. Candidates come
    // least-used first (ties shuffled) and are spread round-robin across chapters.
    async function autoFill(btn) {
      const say = (m, kind) => { try { toast?.(m, kind); } catch { /* ignore */ } };
      if (!state.enabled || !state.sections.length) { say('Add sections first (or load a template)', 'error'); return; }
      if (typeof fetchByMarks !== 'function' || typeof addQuestion !== 'function') return;
      // A paper of only Passage sections never needs a chapter picked (most passage content is
      // chapterless, the "unseen" pool) — only require it when a non-passage section is present.
      const needsChapter = state.sections.some(s => !isPassage(s));
      const gate = needsChapter ? canFill : (canFillPassage || canFill);
      if (typeof gate === 'function' && !gate()) { say(needsChapter ? 'Select the batch, subject and chapters first' : 'Select the batch and subject first', 'error'); return; }
      const label0 = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Filling...'; }
      const keepActive = state.activeId;
      const pools = new Map();
      const used = new Set(selected().map(q => q._id));
      let added = 0;
      const missing = [];
      try {
        for (const sec of state.sections) {
          if (isPassage(sec)) {
            if (sec.passageBlockId || typeof fetchPassageBlocks !== 'function') continue;
            if (!pools.has('passage')) pools.set('passage', await fetchPassageBlocks());
            const usedBlockIds = new Set(state.sections.filter(isPassage).map(s => s.passageBlockId).filter(Boolean));
            const pick = (pools.get('passage') || []).find(b => !usedBlockIds.has(b.id));
            if (pick) { sec.passageBlockId = pick.id; sec.marksEach = pick.totalMarks; sec.attempt = 1; sec._blockTitle = pick.title; sec._block = pick; added++; }
            else missing.push(`${label(sec)}: no unused passage block available`);
            continue;
          }
          const have = selected().filter(q => q.sectionId === sec.id).length;
          const need = Math.max(0, (Number(sec.attempt) || 0) - have);
          if (!need) continue;
          const marks = Number(sec.marksEach);
          if (typeof fetchMcq === 'function' && _isMcqSection(sec)) {
            if (!pools.has('mcq')) pools.set('mcq', (await fetchMcq()).filter(m => (m.type || 'mcq') === 'mcq'));
            const bank = pools.get('mcq');
            if (bank.length) {
              const take = bank.filter(m => !used.has(`mcq:${m._id}`)).map(m => ({ m, r: Math.random() })).sort((a, b) => a.r - b.r).slice(0, need).map(x => x.m);
              state.activeId = sec.id;
              take.forEach(m => { used.add(`mcq:${m._id}`); addQuestion(_mcqToQ(m)); added++; });
              if (take.length < need) missing.push(`${label(sec)}: ${need - take.length} more MCQ${need - take.length === 1 ? '' : 's'} needed`);
              continue;
            }
          }
          if (!pools.has(marks)) pools.set(marks, await fetchByMarks(marks));
          const byChapter = new Map();
          (pools.get(marks) || []).filter(c => !used.has(c._id)).forEach(c => {
            const k = String(c.chapterId || '');
            if (!byChapter.has(k)) byChapter.set(k, []);
            byChapter.get(k).push(c);
          });
          const lists = [...byChapter.values()].map(l => l.map(c => ({ c, r: Math.random() })).sort((a, b) => ((a.c.usageCount || 0) - (b.c.usageCount || 0)) || (a.r - b.r)).map(x => x.c));
          const picks = [];
          for (let i = 0; picks.length < need; i++) {
            let any = false;
            for (const l of lists) { if (i < l.length && picks.length < need) { picks.push(l[i]); any = true; } }
            if (!any) break;
          }
          state.activeId = sec.id;
          picks.forEach(c => { used.add(c._id); addQuestion(c); added++; });
          if (picks.length < need) missing.push(`${label(sec)}: ${need - picks.length} more ${marks}-mark question${need - picks.length === 1 ? '' : 's'} needed`);
        }
      } catch (err) {
        console.error('auto-fill failed', err);
        say('Auto-fill failed, please try again', 'error');
      } finally {
        state.activeId = state.sections.some(s => s.id === keepActive) ? keepActive : (state.sections[0] && state.sections[0].id);
        if (btn) { btn.disabled = false; btn.textContent = label0; }
        refresh();
        notify();
      }
      if (missing.length) say(`Added ${added}. Not enough questions: ${missing.join('; ')}`, 'info');
      else if (added) say(`Auto-filled ${added} question${added === 1 ? '' : 's'}`, 'success');
      else say('All sections already have enough questions', 'info');
    }

    // Called by the builder when a question is added: put it in the active section.
    function assign(q) {
      if (!state.enabled) { q.sectionId = undefined; return true; }
      if (!state.sections.length || !state.activeId) return false;
      const active = state.sections.find(s => s.id === state.activeId);
      if (active && isPassage(active)) return false; // a passage section takes a whole block, not individual questions
      q.sectionId = state.activeId;
      return true;
    }

    // Picker for a whole PassageBlock (comprehension/poetry/nonverbal/writing) — replaces the
    // section's individual questions entirely; see models/PassageBlock.js.
    async function openPassageBlockPicker(sectionId) {
      const say = (m, kind) => { try { toast?.(m, kind); } catch { /* ignore */ } };
      if (typeof fetchPassageBlocks !== 'function') return;
      const gate = canFillPassage || canFill;
      if (typeof gate === 'function' && !gate()) { say('Select the batch and subject first', 'error'); return; }
      const mcqHost = root?.querySelector('[data-pps="mcqpicker"]');
      if (!mcqHost) return;
      mcqHost.style.display = '';
      mcqHost.innerHTML = '<p class="pps-hint">Loading passage blocks...</p>';
      let rows = [];
      try { rows = await fetchPassageBlocks(); } catch { mcqHost.innerHTML = '<p class="pps-hint">Could not load passage blocks.</p>'; return; }
      const paint = term => {
        const t = String(term || '').toLowerCase();
        const shown = rows.filter(b => !t || b.title.toLowerCase().includes(t) || (b.passage || '').toLowerCase().includes(t)).slice(0, 100);
        mcqHost.querySelector('.pps-mcq-list').innerHTML = shown.length ? shown.map(b => `
          <div class="pps-mcq-item">
            <div><div><b>${_esc(b.title)}</b> <span class="pps-chip">${_esc(b.type)}</span> <span class="pps-chip">${b.totalMarks} marks</span></div>
              <div style="opacity:.8;margin-top:2px">${_esc((b.type === 'writing' ? b.scenario : b.passage) || '').slice(0, 140)}${((b.type === 'writing' ? b.scenario : b.passage) || '').length > 140 ? '…' : ''}</div></div>
            <button type="button" class="pps-btn" data-bid="${_esc(b.id)}">Use this</button>
          </div>`).join('') : '<p class="pps-hint">No passage blocks found. Add some in Admin &gt; Passages.</p>';
        mcqHost.querySelectorAll('[data-bid]').forEach(btn => btn.addEventListener('click', () => {
          const b = rows.find(x => x.id === btn.dataset.bid);
          const sec = state.sections.find(s => s.id === sectionId);
          if (!b || !sec) return;
          sec.passageBlockId = b.id;
          sec.marksEach = b.totalMarks;
          sec.attempt = 1;
          sec._blockTitle = b.title;
          sec._block = b;
          mcqHost.style.display = 'none';
          renderSections();
          renderSummary();
          notify();
        }));
      };
      mcqHost.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>Passage blocks (${rows.length})</strong><button type="button" class="pps-btn" data-x="close">Close</button></div><input class="pps-in" data-x="search" placeholder="Search title/passage..." style="width:100%;margin-top:6px" /><div class="pps-mcq-list"></div>`;
      mcqHost.querySelector('[data-x="close"]').addEventListener('click', () => { mcqHost.style.display = 'none'; });
      mcqHost.querySelector('[data-x="search"]').addEventListener('input', e => paint(e.target.value));
      paint('');
    }

    function optionsHtml(selectedId) {
      return state.sections.filter(s => !isPassage(s)).map(s => `<option value="${_esc(s.id)}" ${s.id === selectedId ? 'selected' : ''}>${_esc(label(s))}</option>`).join('');
    }

    function reset() {
      state.enabled = false;
      state.sections = [];
      state.activeId = null;
      state.header = DEFAULT_HEADER();
      render();
    }

    // After the builder changes its list, refresh the counts.
    function refresh() {
      if (!state.enabled || !root) return;
      renderSections();
      renderSummary();
    }

    return {
      mount(el) { root = el; render(); },
      isEnabled: () => state.enabled,
      getSections: () => state.sections,
      activeId: () => state.activeId,
      label: id => { const s = state.sections.find(x => x.id === id); return s ? label(s) : ''; },
      optionsHtml,
      assign,
      summary,
      payload,
      reset,
      refresh,
      autoFill,
    };
  }

  return { create, TEMPLATES };
})();

window.PAPER_SECTIONS = PAPER_SECTIONS;
