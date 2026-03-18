
// ══════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════
const TOTAL_WEEKS = 12;
const JR_GAME_SAVE_KEY = 'wglt_budget_boss_jr_save_v2';
const TERM_DEFINITIONS = {
  budgeting: {
    title: 'What is budgeting?',
    body: 'Budgeting means making a simple plan for your money. You decide how much to Spend, Save, and Share before all your dollars run off like squirrels with sneakers.'
  },
  needswants: {
    title: 'Needs vs. Wants',
    body: '<b>Need</b> means something important for living and learning, like food, school supplies, or basic clothes. <br><br><b>Want</b> means something fun or extra, like a treat, game item, or movie snack.'
  },
  goal: {
    title: 'What is a goal?',
    body: 'A money goal is something you are saving for on purpose. A goal helps your Save jar have a mission instead of just sitting there.'
  },
  earnedIncome: {
    title: 'What is earned income?',
    body: 'Earned income is money you get for doing work, like chores, helping in a yard, or running a stand. You worked for it, so you earned it.'
  }
};
const JOB_PAY_LABELS = {
  lemon: 'Lemonade Stand · $5–$8 per week',
  yard: 'Yard Helper · $8–$12 per week',
  chores: 'Household Chores · $4–$6 per week',
  errands: 'Running Errands · $5–$7 per week'
};
const JR_REFLECTION_PROMPTS = {
  default: {
    discussion: 'What made this choice smart, tricky, or both?',
    reflection: [
      'What was the best part of your decision?',
      'Would you do anything differently next time?',
      'Did this choice help now or later?'
    ],
    note: 'Point students back to the jars: Spend, Save, and Share.'
  },
  spend: {
    discussion: "This was a spending choice. Let's think about what the money did.",
    reflection: [
      'Was this worth the money?',
      'Was that a need or a want?',
      'How did this choice affect your money?',
      'Would you make the same choice again?',
      'Did this help your future or just right now?',
      'What could you have done differently?',
      'Was this a smart money move? Why?',
      'Did you follow your plan or change it?',
      'How might this choice affect you later?',
      'Was this worth the money you spent?'
    ],
    note: 'Keep the language simple: what did the student get now, and what did they give up later?'
  },
  save: {
    discussion: 'This choice helped the Save jar. Future-you just got a tiny high-five.',
    reflection: [
      'Did this help future you?',
      'Did you save as much as you wanted?',
      'How did saving change your money?',
      'Was saving now a smart move?',
      'Would you make this save choice again?',
      'Did you stick to your plan?'
    ],
    note: 'Connect the action back to the savings goal and patience.'
  },
  share: {
    discussion: 'This choice helped someone else too.',
    reflection: [
      'How did sharing affect your money?',
      'Was helping worth it for your budget?',
      'Did you help and still protect your plan?',
      'Would you share the same way again?',
      'Was this kind and smart?'
    ],
    note: 'Show students that generosity can live next to planning.'
  },
  monthly: {
    discussion: "Let's zoom out and look at the month so far.",
    reflection: [
      'Which jar grew the most this month?',
      'What would you change before next month?'
    ],
    note: 'Use this as a class checkpoint.'
  },
  final: {
    discussion: 'Which choice changed the whole game the most?',
    reflection: [
      'What was your best money choice in the game?',
      'What would you do differently if you played again?'
    ],
    note: 'End by naming one habit the class practiced.'
  }
};

let state = {
  playerName: '', avatar: '', avatarName: '',
  job:null, cause:null, causeName:'', goal:20,
  week:0, jars:{spend:0,save:0,share:0},
  totalEarned:0, pendingConsequences:[],
  boughtItems:{}, choiceMade:false,
  gameActive:false, finalReached:false,
  reflectionHistory: [],
  currentTeacherReflectionType: 'default'
};
const JOBS = {
  lemon: {
    name: 'Lemonade Stand', emoji: '🍋',
    basePay: 6,   // avg $5–8
    supplies: { name:'Lemons & Cups', emoji:'🍋', cost:2 },
    scenarios: [
      // format: { week, emoji, scenario, question, options:[{emoji,text,effect,spend:null|n,save:n,share:n,consequence:{week,emoji,title,body}}] }
      { week:1, emoji:'☀️', scenario:"It's your first day! You set up your stand and earn money.", question:'What do you do with your $6?', skipChoice:true, autoEarn:6 },
      { week:2, emoji:'🌤️', scenario:"A neighbor walks by and buys 3 cups of lemonade!", question:'You earned extra this week! Do you save it or spend it on something fun?',
        options:[
          { emoji:'🏦', text:'Save it all!', effect:'+$2 to Save jar', save:2, spend:0, share:0 },
          { emoji:'🍦', text:'Buy an ice cream ($2)', effect:'+$0 to Save, −$2 Spend', save:0, spend:-2, share:0 },
          { emoji:'🤝', text:'Split: save $1, spend $1', effect:'+$1 Save, −$1 Spend', save:1, spend:-1, share:0 },
        ]
      },
      { week:3, emoji:'🌡️', scenario:"Uh oh! It's super hot and you ran out of cups!", question:'What should you do?',
        options:[
          { emoji:'🛒', text:'Buy more cups ($1)', effect:'−$1 now, business keeps going!', save:0, spend:-1, share:0,
            consequence:{ week:4, emoji:'💰', title:'Great planning!', body:'Because you bought cups, you stayed open and earned $2 extra next week!' }, bonusNextWeek:2 },
          { emoji:'🏠', text:'Close the stand for today', effect:'No cost, but miss some sales', save:0, spend:0, share:0 },
        ]
      },
      { week:4, emoji:'🌈', scenario:"Your lemonade is so popular, you made extra money this week! 🎉", question:'How do you split the extra $3?',
        options:[
          { emoji:'🎯', text:'All to Save jar!', effect:'+$3 to Save', save:3, spend:0, share:0 },
          { emoji:'💜', text:'$2 Save, $1 to Share', effect:'+$2 Save, +$1 Share', save:2, spend:0, share:1 },
          { emoji:'🍕', text:'Treat yourself ($2) + $1 Save', effect:'+$1 Save, −$2 Spend', save:1, spend:-2, share:0 },
        ]
      },
      { week:5, emoji:'🌧️', scenario:"It rained all week and nobody bought lemonade. You earned less this week.", question:'Your Save jar is looking small. What do you do?',
        options:[
          { emoji:'💪', text:"Keep saving — I'll be patient!", effect:'Keep what you have saved', save:0, spend:0, share:0 },
          { emoji:'😟', text:'Take $2 from Save to spend', effect:'−$2 from Save jar', save:-2, spend:0, share:0 },
        ]
      },
      { week:6, emoji:'🎪', scenario:"A community fair is happening! Lots of people want lemonade!", question:'You earned double this week! How do you use the extra $5?',
        options:[
          { emoji:'🏆', text:'Save $3, Share $1, Spend $1', effect:'Best split!', save:3, spend:-1, share:1 },
          { emoji:'🛍️', text:'Spend it all on fun', effect:'−$5 Spend, $0 Save', save:0, spend:-5, share:0 },
          { emoji:'💜', text:'Save $2, Share $3', effect:'+$2 Save, +$3 Share!', save:2, spend:0, share:3 },
        ]
      },
      { week:7, emoji:'🤝', scenario:"A friend asks to borrow $2. They promise to pay you back next week.", question:'What do you do?',
        options:[
          { emoji:'😊', text:'Lend them $2', effect:'You give $2 now, get it back Week 8', save:0, spend:-2, share:0,
            consequence:{ week:8, emoji:'🤝', title:'Your friend paid you back!', body:'Your friend returned the $2 you lent them. Lending to trustworthy people works out!' }, bonusNextWeek:2 },
          { emoji:'🙅', text:"No thanks, I'm saving", effect:'Keep your $2 safe', save:0, spend:0, share:0 },
          { emoji:'💜', text:'Give it as a gift ($2)', effect:'$2 goes to Share jar', save:0, spend:0, share:2 },
        ]
      },
      { week:8, emoji:'🌟', scenario:"You've been working hard all summer! A customer left a $3 tip!", question:'What do you do with the surprise tip?',
        options:[
          { emoji:'🏦', text:'Add it to savings!', effect:'+$3 to Save jar!', save:3, spend:0, share:0 },
          { emoji:'💜', text:'Donate it to your cause', effect:'+$3 to Share jar!', save:0, spend:0, share:3 },
          { emoji:'🍭', text:'Buy a treat ($2) + save $1', effect:'+$1 Save, −$2 Spend', save:1, spend:-2, share:0 },
        ]
      },
      { week:9, emoji:'🎒', scenario:"School is almost starting. Do you want to buy something for back to school?",
        question:'You have money in your Spend jar. Do you want to use some of it?',
        options:[
          { emoji:'✏️', text:'Buy school supplies ($3)', effect:'−$3 Spend (good use!)', save:0, spend:-3, share:0 },
          { emoji:'🏦', text:'Keep saving!', effect:'Save it for your goal', save:0, spend:0, share:0 },
          { emoji:'🎒', text:'Buy something fun ($2)', effect:'−$2 Spend', save:0, spend:-2, share:0 },
        ]
      },
      { week:10, emoji:'🍁', scenario:"Fall is here! Customers love stopping by after school for a cup of cold lemonade.", question:'You earned extra this week! What do you do with the bonus $2?',
        options:[
          { emoji:'🏦', text:'Add $2 to Save!', effect:'+$2 Save — so close to the goal!', save:2, spend:0, share:0 },
          { emoji:'💜', text:'Give $2 to your cause!', effect:'+$2 Share — generous!', save:0, spend:0, share:2 },
          { emoji:'🍭', text:'Buy a treat ($2)', effect:'−$2 Spend — you earned it!', save:0, spend:-2, share:0 },
        ]
      },
      { week:11, emoji:'❄️', scenario:"Getting cooler outside! You decide to add hot cocoa to your stand to keep customers coming.", question:'Do you spend $2 from your Spend jar to buy cocoa supplies?',
        options:[
          { emoji:'☕', text:'Yes! Buy cocoa supplies ($2)', effect:'−$2 Spend, but more customers!', save:0, spend:-2, share:0,
            consequence:{ week:12, emoji:'🎉', title:'Great business thinking!', body:'The hot cocoa brought new customers! You earned $3 extra this final week!' }, bonusNextWeek:3 },
          { emoji:'🍋', text:'Stick with lemonade only', effect:'No extra cost — keep it simple', save:0, spend:0, share:0 },
        ]
      },
      { week:12, emoji:'🏁', scenario:"Last week of the season! Your lemonade (and cocoa!) stand was a huge success! 🎉", question:'For your very last earnings, how do you split the money?',
        options:[
          { emoji:'🏆', text:'Save + Share + tiny treat', effect:'Perfect final split!', save:2, spend:-1, share:1, isFinal:true },
          { emoji:'🏦', text:'Save it all! Final push!', effect:'+$3 to Save — goal time!', save:3, spend:0, share:0, isFinal:true },
          { emoji:'🎉', text:'Celebrate — spend some!', effect:'You earned this celebration!', save:1, spend:-2, share:0, isFinal:true },
        ]
      },
    ]
  },
  yard: {
    name: 'Yard Helper', emoji: '🌿',
    basePay: 9,   // avg $8–12
    supplies: { name:'Work Gloves & Bags', emoji:'🧤', cost:2 },
    scenarios: [
      { week:1, emoji:'🌳', scenario:"Your first yard job! You rake leaves and bag them up. Great work!", question:'You earned $9 this week. What do you do with it?', skipChoice:true, autoEarn:9 },
      { week:2, emoji:'🌻', scenario:"A neighbor wants you to weed their garden. Extra job, extra money!", question:'You earned $3 extra. Save it or spend it?',
        options:[
          { emoji:'🏦', text:'Save all $3!', effect:'+$3 to Save jar', save:3, spend:0, share:0 },
          { emoji:'🍦', text:'Buy a snack ($2)', effect:'+$1 Save, −$2 Spend', save:1, spend:-2, share:0 },
          { emoji:'💜', text:'$2 Save, $1 Share', effect:'+$2 Save, +$1 Share', save:2, spend:0, share:1 },
        ]
      },
      { week:3, emoji:'🌧️', scenario:"Your work gloves got a hole in them! You need new ones to work safely.", question:'What do you do?',
        options:[
          { emoji:'🧤', text:'Buy new gloves ($2)', effect:'−$2 now, safe to keep working!', save:0, spend:-2, share:0,
            consequence:{ week:4, emoji:'💪', title:'Good choice!', body:'New gloves kept you safe and you finished more jobs this week — earning $2 extra!' }, bonusNextWeek:2 },
          { emoji:'😬', text:'Keep using old gloves', effect:'No cost, but risky...', save:0, spend:0, share:0 },
        ]
      },
      { week:4, emoji:'🏡', scenario:"Three neighbors hired you this week — your best week yet!", question:'You earned $4 extra! How do you split it?',
        options:[
          { emoji:'🎯', text:'All to Save jar!', effect:'+$4 Save — goal getting closer!', save:4, spend:0, share:0 },
          { emoji:'💜', text:'$2 Save, $2 Share', effect:'+$2 Save, +$2 Share', save:2, spend:0, share:2 },
          { emoji:'🎉', text:'$2 Save, $1 Spend, $1 Share', effect:'Balanced split!', save:2, spend:-1, share:1 },
        ]
      },
      { week:5, emoji:'😓', scenario:"It was so hot this week that you could only do two jobs instead of four.", question:"You earned less than usual. How do you feel about your savings?",
        options:[
          { emoji:'💪', text:"I'll keep being patient!", effect:'Great attitude — save what you have', save:0, spend:0, share:0 },
          { emoji:'💸', text:'Take $2 from Save to feel better', effect:'−$2 from Save jar', save:-2, spend:0, share:0 },
        ]
      },
      { week:6, emoji:'🎃', scenario:"A neighbor wants their yard decorated for a party! Big job, big pay!", question:'You earned $5 extra this week! How do you split it?',
        options:[
          { emoji:'🏆', text:'Save $3, Share $1, Spend $1', effect:'Great balance!', save:3, spend:-1, share:1 },
          { emoji:'💜', text:'Save $2, Share $3', effect:'+$2 Save, +$3 to your cause!', save:2, spend:0, share:3 },
          { emoji:'🛍️', text:'Spend $3, Save $2', effect:'You earned it!', save:2, spend:-3, share:0 },
        ]
      },
      { week:7, emoji:'❓', scenario:"You find $3 on the ground near where you were working. Nobody is around.",
        question:'What is the right thing to do?',
        options:[
          { emoji:'🏠', text:"Tell the neighbor — it's probably theirs", effect:'You did the right thing! +karma', save:0, spend:0, share:0,
            consequence:{ week:8, emoji:'🙏', title:'The neighbor was so grateful!', body:'The $3 was theirs. They gave you a $4 tip for being honest! Honesty pays!' }, bonusNextWeek:4 },
          { emoji:'💰', text:'Keep it — finders keepers!', effect:'+$3 to Spend jar', save:0, spend:3, share:0 },
          { emoji:'💜', text:'Donate it to your cause', effect:'+$3 to Share jar', save:0, spend:0, share:3 },
        ]
      },
      { week:8, emoji:'🍂', scenario:"Fall is here and there are TONS of leaves! Super busy week!", question:'You earned $4 extra. Last big push for your savings goal!',
        options:[
          { emoji:'🏆', text:'Save $4 — goal time!', effect:'+$4 to Save! Almost there!', save:4, spend:0, share:0 },
          { emoji:'🎯', text:'$3 Save, $1 Share', effect:'+$3 Save, +$1 Share', save:3, spend:0, share:1 },
          { emoji:'🎉', text:'$2 Save, $2 fun', effect:'+$2 Save, −$2 Spend', save:2, spend:-2, share:0 },
        ]
      },
      { week:9, emoji:'🏫', scenario:"School starts soon. Your neighbor says they'll need you every weekend this fall!",
        question:'Will you keep working after summer?',
        options:[
          { emoji:'✅', text:'Yes! I can handle it!', effect:'More income coming!', save:0, spend:0, share:0 },
          { emoji:'📚', text:'Maybe just one job a week', effect:'Balance school + work', save:0, spend:0, share:0 },
          { emoji:'😴', text:'Take a break, focus on school', effect:'Rest and recharge!', save:0, spend:0, share:0 },
        ]
      },
      { week:10, emoji:'🍁', scenario:"Fall is really here now! Raking leaves is your busiest time of year!", question:'You earned $3 extra this week from all the leaf piles! How do you use it?',
        options:[
          { emoji:'🏦', text:'Save all $3! Big push!', effect:'+$3 Save — almost at goal!', save:3, spend:0, share:0 },
          { emoji:'🎯', text:'$2 Save, $1 Share', effect:'+$2 Save, +$1 to your cause!', save:2, spend:0, share:1 },
          { emoji:'🍫', text:'Treat yourself ($2) + $1 Save', effect:'+$1 Save, −$2 Spend', save:1, spend:-2, share:0 },
        ]
      },
      { week:11, emoji:'❄️', scenario:"It's getting cold! A neighbor asks if you can help rake AND bag their leaves before winter.", question:'You can take on an extra big job for $4 more — but it is hard work!',
        options:[
          { emoji:'💪', text:'Take the job! ($4 extra)', effect:'+$4 bonus this week!', save:0, spend:0, share:0, bonusNextWeek:4 },
          { emoji:'😴', text:'Take a break — I worked hard all season', effect:'No extra, rest up!', save:0, spend:0, share:0 },
          { emoji:'🤝', text:'Do it and donate the $4', effect:'+$4 to Share jar!', save:0, spend:0, share:4 },
        ]
      },
      { week:12, emoji:'🏁', scenario:"Last week of the season! The whole neighborhood loves your yard work! 🎉", question:'Final week! How do you split your last earnings?',
        options:[
          { emoji:'🏆', text:'Save + Share + celebrate!', effect:'Perfect ending!', save:3, spend:-2, share:2, isFinal:true },
          { emoji:'🏦', text:'Save it all! Goal first!', effect:'Final push to the goal!', save:5, spend:0, share:0, isFinal:true },
          { emoji:'💜', text:'$3 Save, $4 Share', effect:'Generous ending!', save:3, spend:0, share:4, isFinal:true },
        ]
      },
    ]
  },

  chores: {
    name: 'Household Chores', emoji: '🧹',
    basePay: 5,   // avg $4–6
    supplies: { name:'Cleaning Supplies', emoji:'🧴', cost:1 },
    scenarios: [
      { week:1, emoji:'🏠', scenario:"First week of chores! You cleaned your room, washed dishes, and vacuumed. Great job!", question:'You earned $5 this week. Watch your jars fill up!', skipChoice:true, autoEarn:5 },
      { week:2, emoji:'✨', scenario:"Mom asked you to clean the bathroom too — and paid you extra!", question:'You got $2 extra for the bathroom job! What do you do with it?',
        options:[
          { emoji:'🏦', text:'Save the whole $2!', effect:'+$2 to Save jar', save:2, spend:0, share:0 },
          { emoji:'🍭', text:'Buy a treat ($2)', effect:'Fun now, nothing to Save', save:0, spend:-2, share:0 },
          { emoji:'🤝', text:'$1 Save, $1 Share', effect:'+$1 Save, +$1 Share', save:1, spend:0, share:1 },
        ]
      },
      { week:3, emoji:'🧴', scenario:"You ran out of cleaning spray! You need it to finish your chores properly.", question:'What do you do?',
        options:[
          { emoji:'🛒', text:'Buy more spray ($1)', effect:'−$1 now, chores get done right!', save:0, spend:-1, share:0,
            consequence:{ week:4, emoji:'⭐', title:'Nice work!', body:'You finished every chore perfectly and got a $2 bonus for doing such a great job!' }, bonusNextWeek:2 },
          { emoji:'😬', text:'Skip the cleaning — no spray', effect:'No cost, but chores not done well', save:0, spend:0, share:0 },
        ]
      },
      { week:4, emoji:'🌟', scenario:"Your family noticed how clean the house is! They gave you a bonus!", question:'You earned an extra $3 this week! How do you split it?',
        options:[
          { emoji:'🎯', text:'All to Save jar!', effect:'+$3 Save — goal getting closer!', save:3, spend:0, share:0 },
          { emoji:'💜', text:'$2 Save, $1 Share', effect:'+$2 Save, +$1 Share', save:2, spend:0, share:1 },
          { emoji:'🎉', text:'Treat yourself ($2), save $1', effect:'+$1 Save, −$2 Spend', save:1, spend:-2, share:0 },
        ]
      },
      { week:5, emoji:'😓', scenario:"This week was really busy with school. You only finished half your chores.", question:'You earned less this week. How do you feel about your Save jar?',
        options:[
          { emoji:'💪', text:'Stay patient — keep saving!', effect:'Great attitude! Keep going.', save:0, spend:0, share:0 },
          { emoji:'😟', text:'Take $2 from Save jar', effect:'−$2 from Save jar', save:-2, spend:0, share:0 },
        ]
      },
      { week:6, emoji:'🎂', scenario:"It's a family celebration! You helped set up, cook, and clean up the whole party!", question:'You earned $4 extra for helping at the party! How do you split it?',
        options:[
          { emoji:'🏆', text:'$2 Save, $1 Share, $1 Spend', effect:'Perfect balance!', save:2, spend:-1, share:1 },
          { emoji:'🏦', text:'Save it all!', effect:'+$4 Save — amazing push!', save:4, spend:0, share:0 },
          { emoji:'💜', text:'$2 Save, $2 Share', effect:'+$2 Save, +$2 Share!', save:2, spend:0, share:2 },
        ]
      },
      { week:7, emoji:'🔍', scenario:"While dusting, you find $2 behind the couch cushions. Nobody saw you find it.", question:'What do you do with the found $2?',
        options:[
          { emoji:'🏠', text:"Tell your family — it's probably theirs", effect:'Honest choice!', save:0, spend:0, share:0,
            consequence:{ week:8, emoji:'🤗', title:'Your family was so happy!', body:'Your family said keep it as a reward for being honest. They gave you $3 for doing the right thing!' }, bonusNextWeek:3 },
          { emoji:'💰', text:'Keep it — you found it!', effect:'+$2 to Spend jar', save:0, spend:2, share:0 },
          { emoji:'💜', text:'Donate it to your cause', effect:'+$2 to Share jar', save:0, spend:0, share:2 },
        ]
      },
      { week:8, emoji:'💫', scenario:"You've been helping all summer! Your chores are looking really professional.", question:'You earned a $3 bonus for quality work! What do you do?',
        options:[
          { emoji:'🏦', text:'Save the whole $3!', effect:'+$3 Save — so close to goal!', save:3, spend:0, share:0 },
          { emoji:'💜', text:'$2 Save, $1 Share', effect:'+$2 Save, +$1 Share', save:2, spend:0, share:1 },
          { emoji:'🎉', text:'Celebrate with $2, save $1', effect:'+$1 Save, −$2 Spend', save:1, spend:-2, share:0 },
        ]
      },
      { week:9, emoji:'🎒', scenario:"School started! You still want to help at home, but homework comes first.", question:'How much time will you give to chores this week?',
        options:[
          { emoji:'✅', text:'All my usual chores!', effect:'Keep earning full amount', save:0, spend:0, share:0 },
          { emoji:'📚', text:'Half my chores — school first', effect:'Less income, more study time', save:0, spend:0, share:0 },
          { emoji:'😴', text:'Take a break this week', effect:'No income, but well rested!', save:0, spend:0, share:0 },
        ]
      },
      { week:10, emoji:'🍂', scenario:"Fall means more chores — raking inside porch, putting away summer stuff!", question:'You earned $2 extra for fall cleanup. How do you use it?',
        options:[
          { emoji:'🏦', text:'Save $2 — final push!', effect:'+$2 Save — almost there!', save:2, spend:0, share:0 },
          { emoji:'💜', text:'$1 Save, $1 Share', effect:'+$1 Save, +$1 Share', save:1, spend:0, share:1 },
          { emoji:'🍫', text:'Buy a treat ($2)', effect:'You earned some fun!', save:0, spend:-2, share:0 },
        ]
      },
      { week:11, emoji:'❄️', scenario:"It's getting cold! Your family asks you to help prepare the house for winter — big job!", question:'Do you take on the extra winter-prep chores for $3 more?',
        options:[
          { emoji:'💪', text:'Yes! I can do it! (+$3)', effect:'+$3 bonus next week!', save:0, spend:0, share:0, bonusNextWeek:3 },
          { emoji:'☕', text:'Take it easy this week', effect:'Rest and relax', save:0, spend:0, share:0 },
          { emoji:'💜', text:'Do it and donate the $3', effect:'+$3 to Share jar!', save:0, spend:0, share:3 },
        ]
      },
      { week:12, emoji:'🏁', scenario:"Final week! Your home sparkles! The whole family is proud of how helpful you've been! 🎉", question:'Last week! How do you split your final earnings?',
        options:[
          { emoji:'🏆', text:'Save + Share + tiny treat', effect:'Perfect final split!', save:2, spend:-1, share:1, isFinal:true },
          { emoji:'🏦', text:'Save it all — goal time!', effect:'Final push to your goal!', save:3, spend:0, share:0, isFinal:true },
          { emoji:'💜', text:'Big share week!', effect:'+$2 Save, +$2 Share', save:2, spend:0, share:2, isFinal:true },
        ]
      },
    ]
  },

  errands: {
    name: 'Running Errands', emoji: '🚲',
    basePay: 6,   // avg $5–7
    supplies: { name:'Errand Bag', emoji:'🎒', cost:1 },
    scenarios: [
      { week:1, emoji:'🚲', scenario:"First errand day! You picked up groceries for a neighbor and mailed a letter. Off to a great start!", question:'You earned $6 this week. Watch your jars fill up!', skipChoice:true, autoEarn:6 },
      { week:2, emoji:'🛒', scenario:"A neighbor asked you to do TWO errands this week — double the trips!", question:'You earned $2 extra! What do you do with it?',
        options:[
          { emoji:'🏦', text:'Save it all!', effect:'+$2 to Save jar', save:2, spend:0, share:0 },
          { emoji:'🍦', text:'Buy a treat ($2)', effect:'Fun now, $0 to Save', save:0, spend:-2, share:0 },
          { emoji:'🤝', text:'$1 Save, $1 Share', effect:'+$1 Save, +$1 Share', save:1, spend:0, share:1 },
        ]
      },
      { week:3, emoji:'🗺️', scenario:"You went to the wrong store! You have to go back and do the errand again — embarrassing!", question:'How do you feel, and what do you do differently next time?',
        options:[
          { emoji:'📝', text:'Write down the address next time', effect:'Good planning! Neighbor gives a tip', save:0, spend:0, share:0,
            consequence:{ week:4, emoji:'⭐', title:'Great learning!', body:'You wrote things down and got every errand right this week. Neighbor tipped you $2!' }, bonusNextWeek:2 },
          { emoji:'😞', text:'Just try to remember better', effect:'No extra cost, but risky', save:0, spend:0, share:0 },
        ]
      },
      { week:4, emoji:'⭐', scenario:"Best errand week yet — four neighbors hired you!", question:'You earned $3 extra! How do you split it?',
        options:[
          { emoji:'🎯', text:'All to Save!', effect:'+$3 Save — great progress!', save:3, spend:0, share:0 },
          { emoji:'💜', text:'$2 Save, $1 Share', effect:'+$2 Save, +$1 Share', save:2, spend:0, share:1 },
          { emoji:'🎉', text:'$1 Save, $2 treat', effect:'+$1 Save, −$2 Spend', save:1, spend:-2, share:0 },
        ]
      },
      { week:5, emoji:'🌧️', scenario:"It rained every day this week and it wasn't safe to bike. You only did one errand.", question:'The Save jar barely grew. What do you do?',
        options:[
          { emoji:'💪', text:"Stay patient! Rain can't last forever.", effect:'Good attitude! Keep saving.', save:0, spend:0, share:0 },
          { emoji:'😟', text:'Take $2 out of Save jar', effect:'−$2 from Save — sets back goal', save:-2, spend:0, share:0 },
        ]
      },
      { week:6, emoji:'🏪', scenario:"The whole block has errands this week — back to school supply runs for every family!", question:'You earned $5 extra! How do you split the big haul?',
        options:[
          { emoji:'🏆', text:'$3 Save, $1 Share, $1 Spend', effect:'Great balance!', save:3, spend:-1, share:1 },
          { emoji:'🏦', text:'Save it all!', effect:'+$5 Save — huge week!', save:5, spend:0, share:0 },
          { emoji:'💜', text:'$2 Save, $3 Share', effect:'+$2 Save, +$3 to your cause!', save:2, spend:0, share:3 },
        ]
      },
      { week:7, emoji:'📦', scenario:"A neighbor asks you to return a package to the store. There's a $5 gift card inside that wasn't supposed to be there.", question:'What do you do with the gift card?',
        options:[
          { emoji:'🏠', text:"Tell the neighbor — it belongs to them", effect:'Honest choice!', save:0, spend:0, share:0,
            consequence:{ week:8, emoji:'🤗', title:'The neighbor was thrilled!', body:'You returned the gift card. The neighbor was so thankful they gave you a $4 tip! Honesty always pays.' }, bonusNextWeek:4 },
          { emoji:'💳', text:'Keep it — you found it!', effect:'+$5 Spend (but is it really yours?)', save:0, spend:5, share:0 },
          { emoji:'💜', text:'Donate the gift card value', effect:'+$5 to Share jar', save:0, spend:0, share:5 },
        ]
      },
      { week:8, emoji:'🌟', scenario:"You've built a great reputation! Three new neighbors want YOU to run their errands.", question:'You got a $3 tip for being so reliable! What do you do?',
        options:[
          { emoji:'🏦', text:'Save the whole $3!', effect:'+$3 Save — so close!', save:3, spend:0, share:0 },
          { emoji:'💜', text:'$2 Save, $1 Share', effect:'+$2 Save, +$1 Share', save:2, spend:0, share:1 },
          { emoji:'🎊', text:'Celebrate $2, save $1', effect:'+$1 Save, −$2 Spend', save:1, spend:-2, share:0 },
        ]
      },
      { week:9, emoji:'🎒', scenario:"School started! You still want to run errands on weekends, but homework matters most.", question:'How do you balance errands and school?',
        options:[
          { emoji:'✅', text:'Weekend errands only — I can do it!', effect:'Full weekend earnings', save:0, spend:0, share:0 },
          { emoji:'📚', text:'One errand a week — school first', effect:'Smaller income, more study time', save:0, spend:0, share:0 },
          { emoji:'😴', text:'Take a month off for school', effect:'No income — but fully focused', save:0, spend:0, share:0 },
        ]
      },
      { week:10, emoji:'🍂', scenario:"Fall errands are busiest — pumpkins to carry, donations to drop off!", question:'You earned $2 extra from fall errands. How do you use it?',
        options:[
          { emoji:'🏦', text:'Save $2 — final stretch!', effect:'+$2 Save — almost there!', save:2, spend:0, share:0 },
          { emoji:'💜', text:'$1 Save, $1 Share', effect:'+$1 Save, +$1 Share', save:1, spend:0, share:1 },
          { emoji:'🍫', text:'Treat yourself ($2)', effect:'You earned some fun!', save:0, spend:-2, share:0 },
        ]
      },
      { week:11, emoji:'❄️', scenario:"Cold outside! A neighbor needs help picking up winter supplies — heavy bags, long list!", question:'Take on the big cold-weather errand run for $3 extra?',
        options:[
          { emoji:'🧥', text:'Bundle up and do it! (+$3)', effect:'+$3 bonus next week!', save:0, spend:0, share:0, bonusNextWeek:3 },
          { emoji:'🏠', text:"Too cold — I'll stay in", effect:'No extra, stay warm!', save:0, spend:0, share:0 },
          { emoji:'💜', text:'Do it and donate the $3', effect:'+$3 to Share jar!', save:0, spend:0, share:3 },
        ]
      },
      { week:12, emoji:'🏁', scenario:"Last errand week! The whole neighborhood trusts you. You're the best helper on the block! 🎉", question:'Final week! How do you split your last earnings?',
        options:[
          { emoji:'🏆', text:'Save + Share + celebrate!', effect:'Perfect final split!', save:2, spend:-1, share:2, isFinal:true },
          { emoji:'🏦', text:'Save it all — hit that goal!', effect:'Final push!', save:4, spend:0, share:0, isFinal:true },
          { emoji:'💜', text:'$2 Save, $3 Share', effect:'Generous ending!', save:2, spend:0, share:3, isFinal:true },
        ]
      },
    ]
  },

};

// Spend shop items (same for both jobs)
const SHOP_ITEMS = [
  { id:'icecream', emoji:'🍦', name:'Ice Cream', cost:2, oneTime:false },
  { id:'book',     emoji:'📖', name:'Fun Book',  cost:3, oneTime:true  },
  { id:'stickers', emoji:'✨', name:'Stickers',  cost:1, oneTime:false },
  { id:'toy',      emoji:'🧸', name:'Small Toy', cost:4, oneTime:true  },
  { id:'snack',    emoji:'🍿', name:'Snacks',    cost:2, oneTime:false },
  { id:'card',     emoji:'🎴', name:'Trading Card', cost:3, oneTime:false },
];

const WEEK_EMOJIS = ['☀️','🌤️','⛅','🌡️','🌧️','🌈','🌟','🍂','🎒','🍁','❄️','🏁'];
const SHARED_PROFILE_KEY = 'wgltSharedPlayerProfile';
function saveSharedProfile(){ try{ localStorage.setItem(SHARED_PROFILE_KEY, JSON.stringify({ playerName: state.playerName || '', avatar: state.avatar || '', avatarName: state.avatarName || '', updatedAt: new Date().toISOString() })); }catch(err){} }
function loadSharedProfile(){ try{ const raw = localStorage.getItem(SHARED_PROFILE_KEY); return raw ? JSON.parse(raw) : null; }catch(err){ return null; } }
function clearSharedProfile(){ try{ localStorage.removeItem(SHARED_PROFILE_KEY); }catch(err){} }
function snapshotGameState(){
  return {
    savedAt: new Date().toISOString(),
    state: JSON.parse(JSON.stringify(state)),
    teacherMode: isTeacherJrMode()
  };
}
function saveGameProgress(silent=false){
  try{
    localStorage.setItem(JR_GAME_SAVE_KEY, JSON.stringify(snapshotGameState()));
    updateResumeButton();
    if(!silent) showModal('💾','Progress Saved!','Your Jr game is saved on this browser. You can use Resume Last Game later.','Nice! 👍', closeModal);
  }catch(err){
    if(!silent) showModal('⚠️','Save Problem','This browser would not save the game right now.','OK', closeModal);
  }
}
function loadSavedGame(){
  try{
    const raw = localStorage.getItem(JR_GAME_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(err){ return null; }
}
function clearSavedGame(){ try{ localStorage.removeItem(JR_GAME_SAVE_KEY); }catch(err){} updateResumeButton(); }
function updateResumeButton(){
  const btn = document.getElementById('resume-btn');
  const data = loadSavedGame();
  if(btn) btn.disabled = !(data && data.state && (data.state.gameActive || data.state.week > 0 || data.state.finalReached));
}
function syncEarnedIncomeLabel(){
  const el = document.getElementById('earned-income-text');
  if(!el) return;
  el.textContent = state.job ? (JOB_PAY_LABELS[state.job] || JOBS[state.job].name) : 'Not picked yet';
}
function restoreSelectionsUI(){
  document.querySelectorAll('.job-card').forEach(c=>c.classList.remove('selected'));
  document.querySelectorAll('.cause-btn').forEach(b=>b.classList.remove('selected'));
  document.querySelectorAll('.goal-btn').forEach(b=>b.classList.remove('selected'));
  if(state.job && document.getElementById('job-'+state.job)) document.getElementById('job-'+state.job).classList.add('selected');
  if(state.cause && document.getElementById('cause-'+state.cause)) document.getElementById('cause-'+state.cause).classList.add('selected');
  if(state.goal && document.getElementById('goal-'+state.goal)) document.getElementById('goal-'+state.goal).classList.add('selected');
  syncEarnedIncomeLabel();
}
function refreshGameUIAfterLoad(){
  updateHeaderAvatar();
  updateHeader();
  updateJars();
  restoreSelectionsUI();
  document.getElementById('week-progress').style.display = state.gameActive || state.finalReached ? 'flex' : 'none';
  document.getElementById('choice-card').style.display = 'none';
  document.getElementById('spend-section').style.display = state.gameActive || state.finalReached ? 'block' : 'none';
  document.getElementById('next-btn').disabled = false;
  if(state.gameActive || state.finalReached){
    showScreen(state.finalReached ? 'screen-report' : 'screen-game');
    if(!state.finalReached){
      const scenario = JOBS[state.job]?.scenarios?.[Math.max(0, state.week-1)];
      if(scenario) updateTeacherWeekPrompt(scenario, state.currentTeacherReflectionType || 'default');
    }
  }else{
    showScreen('screen-welcome');
  }
  if(state.finalReached) buildReport();
}
function resumeGame(){
  const saved = loadSavedGame();
  if(!(saved && saved.state)) return;
  state = Object.assign({}, state, saved.state);
  if(!state.reflectionHistory) state.reflectionHistory = [];
  if(!state.currentTeacherReflectionType) state.currentTeacherReflectionType = 'default';
  hydrateSharedProfileUI();
updateResumeButton();
syncEarnedIncomeLabel();
  refreshGameUIAfterLoad();
}
function returnToMenu(){
  saveGameProgress(true);
  showScreen('screen-welcome');
  updateResumeButton();
}
function showTermDefinition(termKey){
  const term = TERM_DEFINITIONS[termKey];
  if(!term) return;
  showModal('📘', term.title, term.body, 'Got it! 👍', closeModal);
}
function openTeacherQuestion(question, type='default'){
  const pack = JR_REFLECTION_PROMPTS[type] || JR_REFLECTION_PROMPTS.default;
  showModal('🪞','Class Reflection Question', question + '<br><br><b>Teacher tip:</b> ' + pack.note + '<br><br><b>Teacher Mode prompt:</b> What would you tell a friend to do here?', 'Read it out loud 🎤', closeModal);
}

// ══════════════════════════════════════════════════════════════════
// AVATAR & NAME
// ══════════════════════════════════════════════════════════════════
function selectAvatar(emoji, name) {
  state.avatar = emoji;
  state.avatarName = name;
  // Update grid selection
  document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
  // Find the clicked button by matching emoji
  document.querySelectorAll('.avatar-btn').forEach(b => {
    if (b.querySelector('.av-emoji') && b.querySelector('.av-emoji').textContent === emoji) {
      b.classList.add('selected');
    }
  });
  saveSharedProfile();
  checkStartReady();
}

function onNameInput(val) {
  state.playerName = val.trim();
  saveSharedProfile();
  saveGameProgress(true);
  checkStartReady();
}

function updateHeaderAvatar() {
  if (state.avatar) {
    document.getElementById('header-logo').style.display = 'none';
    const ha = document.getElementById('header-avatar');
    ha.style.display = 'flex';
    document.getElementById('header-avatar-emoji').textContent = state.avatar;
    document.getElementById('header-avatar-name').textContent = state.playerName || state.avatarName;
  }
}

// ══════════════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════════════
function selectJob(id) {
  state.job = id;
  document.querySelectorAll('.job-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('job-'+id).classList.add('selected');
  syncEarnedIncomeLabel();
  saveGameProgress(true);
  checkStartReady();
}

function selectCause(id, name) {
  state.cause = id;
  state.causeName = name;
  document.querySelectorAll('.cause-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('cause-'+id).classList.add('selected');
  saveGameProgress(true);
  checkStartReady();
}

function selectGoal(amount) {
  state.goal = amount;
  document.querySelectorAll('.goal-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('goal-'+amount).classList.add('selected');
  saveGameProgress(true);
  checkStartReady();
}

function checkStartReady() {
  document.getElementById('start-btn').disabled = !(state.job && state.cause && state.goal && state.avatar);
}

// ══════════════════════════════════════════════════════════════════
// GAME START
// ══════════════════════════════════════════════════════════════════
function startGame() {
  saveSharedProfile();
  state.week = 0;
  state.jars = { spend:0, save:0, share:0 };
  state.totalEarned = 0;
  state.pendingConsequences = [];
  state.boughtItems = {};
  state.gameActive = true;
  state.finalReached = false;
  state.reflectionHistory = [];
  state.currentTeacherReflectionType = 'default';

  updateHeaderAvatar();
  showScreen('screen-game');
  document.getElementById('week-progress').style.display = 'flex';

  const greeting = state.playerName ? `Ready, ${state.playerName}? ${state.avatar}` : `Let's go! ${state.avatar}`;
  // Auto-split jar explanation
  saveGameProgress(true);
  showModal('💰', 'How Money Works Here!',
    'When you earn money, it gets split into 3 jars:\n\n' +
    '🛍️ Spend — money for fun things\n' +
    '🏦 Save — money for your goal\n' +
    '💜 Share — money for ' + state.causeName +
    '\n\nEach week you\'ll earn money and make choices. Ready?',
    greeting, () => advanceWeek()
  );
}

// ══════════════════════════════════════════════════════════════════
// WEEK FLOW
// ══════════════════════════════════════════════════════════════════
function advanceWeek() {
  state.week++;
  if (state.week > TOTAL_WEEKS) { endGame(); return; }

  updateProgressBar();
  hideConsequenceBanner();
  document.getElementById('choice-card').style.display = 'none';
  document.getElementById('spend-section').style.display = 'none';
  document.getElementById('next-btn').disabled = true;
  state.choiceMade = false;

  // Fire pending consequences for this week
  firePendingConsequences(state.week, () => {
    loadWeekScenario(state.week);
  });
}

function firePendingConsequences(week, cb) {
  const due = state.pendingConsequences.filter(c => c.week === week);
  state.pendingConsequences = state.pendingConsequences.filter(c => c.week !== week);

  if (due.length === 0) { cb(); return; }

  const c = due[0];
  if (c.bonusAmount) {
    earnMoney(c.bonusAmount, 'Bonus from last week\'s choice!', '🎉');
  }
  showConsequenceBanner(c.emoji, c.title, c.body);
  setTimeout(cb, 2800);
}

function loadWeekScenario(week) {
  const job = JOBS[state.job];
  const scenario = job.scenarios[week - 1];
  if (!scenario) { endGame(); return; }

  // Auto-earn base pay
  const pay = job.basePay + (Math.random() > .5 ? 1 : 0); // small variance
  earnMoney(pay, job.name + ' pay 💵', job.emoji);

  // Update teacher info
  document.getElementById('teacher-info').textContent =
    `Week ${week}: ${scenario.scenario} | FL Standards: Earning (#1), Saving (#3), Spending (#2), Sharing`;
  updateTeacherWeekPrompt(scenario);

  if (scenario.skipChoice) {
    // Week 1 — just earn, show a modal, then allow next
    setTimeout(() => {
      showModal(scenario.emoji, 'Week ' + week + ' — ' + scenario.emoji,
        'You earned $' + pay + ' this week! It was split into your three jars automatically.\n\n' +
        '🛍️ Spend: $' + fmt(state.jars.spend) + '   🏦 Save: $' + fmt(state.jars.save) + '   💜 Share: $' + fmt(state.jars.share),
        'Got it! 👍', () => {
          showSpendSection();
          document.getElementById('next-btn').disabled = false;
          state.choiceMade = true;
        }
      );
    }, 400);
  } else {
    setTimeout(() => showChoiceCard(scenario), 400);
  }
}

// ══════════════════════════════════════════════════════════════════
// EARN MONEY — splits into jars automatically (60/30/10)
// ══════════════════════════════════════════════════════════════════
function earnMoney(amount, label, emoji) {
  // Split: 60% spend, 30% save, 10% share
  const saveAmt  = Math.round(amount * 0.30);
  const shareAmt = Math.round(amount * 0.10);
  const spendAmt = amount - saveAmt - shareAmt;

  state.jars.spend  += spendAmt;
  state.jars.save   += saveAmt;
  state.jars.share  += shareAmt;
  state.totalEarned += amount;

  addLedger('income', emoji || '💵', label, '+$' + amount);
  updateJars();
  updateHeader();
  animateCoin();
}

function adjustJars(save, spend, share) {
  // spend is negative when removing (buying)
  state.jars.spend = Math.max(0, state.jars.spend + spend);
  state.jars.save  = Math.max(0, state.jars.save  + save);
  state.jars.share = Math.max(0, state.jars.share + share);
  updateJars();
  updateHeader();
}

// ══════════════════════════════════════════════════════════════════
// CHOICE CARD
// ══════════════════════════════════════════════════════════════════
function showChoiceCard(scenario) {
  const card = document.getElementById('choice-card');
  document.getElementById('cc-week').textContent = 'Week ' + scenario.week + ' ' + scenario.emoji;
  document.getElementById('cc-emoji').textContent = scenario.emoji;
  document.getElementById('cc-scenario').textContent = scenario.scenario;
  document.getElementById('cc-question').textContent = scenario.question;

  const opts = document.getElementById('cc-options');
  opts.innerHTML = '';
  scenario.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-opt';
    btn.innerHTML = `<span class="opt-emoji">${opt.emoji}</span>
      <div><div class="opt-text">${opt.text}</div><div class="opt-effect">${opt.effect}</div></div>`;
    btn.onclick = () => makeChoice(opt, scenario, btn);
    opts.appendChild(btn);
  });

  card.style.display = 'block';
}

function makeChoice(opt, scenario, btn) {
  if (state.choiceMade) return;
  state.choiceMade = true;

  // Disable all buttons
  document.querySelectorAll('.choice-opt').forEach(b => {
    b.style.opacity = '.5'; b.style.cursor = 'default';
  });
  btn.style.opacity = '1';
  btn.style.borderColor = 'var(--sky)';
  btn.style.background = 'var(--sky-lt)';

  // Apply jar adjustments
  adjustJars(opt.save || 0, opt.spend || 0, opt.share || 0);

  // Log the choice
  const jarNote = [];
  if (opt.save > 0) jarNote.push('Save +$'+opt.save);
  if (opt.share > 0) jarNote.push('Share +$'+opt.share);
  if (opt.spend < 0) jarNote.push('Spend −$'+Math.abs(opt.spend));
  addLedger('event', opt.emoji, 'Choice: ' + opt.text, jarNote.join(' | '));

  // Queue consequence
  if (opt.consequence) {
    state.pendingConsequences.push({
      week: opt.consequence.week,
      emoji: opt.consequence.emoji,
      title: opt.consequence.title,
      body: opt.consequence.body,
      bonusAmount: opt.bonusNextWeek || 0,
    });
  } else if (opt.bonusNextWeek) {
    state.pendingConsequences.push({
      week: state.week + 1,
      emoji: '🎉', title: 'Bonus from your choice!',
      body: 'Your decision last week paid off!',
      bonusAmount: opt.bonusNextWeek
    });
  }

  // Check if final
  if (opt.isFinal) state.finalReached = true;

  const reflectionType = getReflectionTypeForChoice(opt);
  state.currentTeacherReflectionType = reflectionType;
  const pack = JR_REFLECTION_PROMPTS[reflectionType] || JR_REFLECTION_PROMPTS.default;
  const leadQuestion = pack.reflection[0];
  state.reflectionHistory = state.reflectionHistory || [];
  state.reflectionHistory.unshift({ week: state.week, type: reflectionType, typeLabel: reflectionType.charAt(0).toUpperCase() + reflectionType.slice(1), question: leadQuestion, choiceText: opt.text });

  // Show spend section
  setTimeout(() => {
    showSpendSection();
    document.getElementById('next-btn').disabled = false;
    if (isTeacherJrMode()) updateTeacherWeekPrompt(scenario, reflectionType);
    saveGameProgress(true);
  }, 400);
}

// ══════════════════════════════════════════════════════════════════
// SPEND SECTION
// ══════════════════════════════════════════════════════════════════
function showSpendSection() {
  const section = document.getElementById('spend-section');
  const grid = document.getElementById('spend-items');
  grid.innerHTML = '';

  // Only show items the player can potentially afford
  SHOP_ITEMS.forEach(item => {
    const alreadyBought = item.oneTime && state.boughtItems[item.id];
    const div = document.createElement('div');
    div.className = 'spend-item' + (alreadyBought ? ' bought' : '');
    div.innerHTML = `<span class="s-emoji">${item.emoji}</span>
      <span class="s-name">${item.name}</span>
      <span class="s-cost">$${item.cost}</span>`;
    if (!alreadyBought) {
      div.onclick = () => buyItem(item, div);
    }
    grid.appendChild(div);
  });

  section.style.display = 'block';
}

function buyItem(item, el) {
  if (state.jars.spend < item.cost) {
    showModal('😅', 'Not Enough!',
      'You only have $' + fmt(state.jars.spend) + ' in your Spend jar. Keep earning!',
      'OK', closeModal);
    return;
  }
  state.jars.spend -= item.cost;
  if (item.oneTime) { state.boughtItems[item.id] = true; el.classList.add('bought'); }
  addLedger('expense', item.emoji, 'Bought: '+item.name, '−$'+item.cost);
  updateJars();
  updateHeader();
  saveGameProgress(true);

  // mini celebration
  el.style.background='var(--grass-lt)';
  setTimeout(()=>{ el.style.background=''; },600);
}

// ══════════════════════════════════════════════════════════════════
// NEXT WEEK
// ══════════════════════════════════════════════════════════════════
function nextWeek() {
  if (state.week >= TOTAL_WEEKS) { endGame(); return; }
  advanceWeek();
  scrollTop();
}

// ══════════════════════════════════════════════════════════════════
// END GAME
// ══════════════════════════════════════════════════════════════════
function endGame() {
  state.gameActive = false;
  saveGameProgress(true);
  launchConfetti();
  setTimeout(() => {
    buildReport();
    showScreen('screen-report');
  }, 800);
}

function buildReport() {
  const saved  = state.jars.save;
  const shared = state.jars.share;
  const earned = state.totalEarned;
  const goalHit = saved >= state.goal;
  const name = state.playerName || 'Budget Boss';

  // Avatar & personalized title
  document.getElementById('report-avatar').textContent = state.avatar || '🎉';
  document.getElementById('report-title').textContent = `🎉 Amazing work, ${name}!`;

  document.getElementById('rs-earned').textContent = '$' + fmt(earned);
  document.getElementById('rs-saved').textContent  = '$' + fmt(saved);
  document.getElementById('rs-shared').textContent = '$' + fmt(shared) + ' to ' + state.causeName;

  // Stars (1–5)
  let stars = 1;
  if (saved >= state.goal * .4) stars = 2;
  if (saved >= state.goal * .7) stars = 3;
  if (saved >= state.goal)       stars = 4;
  if (saved >= state.goal && shared >= 3) stars = 5;

  const starsEl = document.getElementById('report-stars');
  starsEl.innerHTML = '';
  for (let i=0;i<5;i++) {
    const s = document.createElement('span');
    s.className = 'report-star';
    s.textContent = i < stars ? '⭐' : '☆';
    starsEl.appendChild(s);
  }

  // Badge
  const badges = [
    { min:5, title:'🏆 Super Star Saver!',    sub:'You crushed your goal AND helped others!' },
    { min:4, title:'🎯 Goal Getter!',           sub:'You hit your savings goal! Amazing work!' },
    { min:3, title:'💪 Great Progress!',        sub:'You saved a lot this summer. Keep it up!' },
    { min:2, title:'🌱 Growing Saver!',         sub:'You\'re learning to save. Practice makes perfect!' },
    { min:1, title:'🎉 You Finished Summer!',   sub:'Every week you learned something about money!' },
  ];
  const badge = badges.find(b => stars >= b.min) || badges[badges.length-1];
  document.getElementById('badge-title').textContent = badge.title;
  document.getElementById('badge-sub').textContent   = badge.sub;

  document.getElementById('report-subtitle').textContent =
    `${name} finished all ${TOTAL_WEEKS} weeks as a ${JOBS[state.job].name}!`;
  if(isTeacherJrMode()){
    renderTeacherReflectionBox(`
      <div><b>🏁 Final Reflection</b></div>
      <div style="margin-top:8px"><b>Discussion Prompt</b><br>${JR_REFLECTION_PROMPTS.final.discussion}</div>
      <div style="margin-top:8px"><b>Ask students</b><ul style="margin:6px 0 0 18px"><li>${JR_REFLECTION_PROMPTS.final.reflection[0]}</li><li>${JR_REFLECTION_PROMPTS.final.reflection[1]}</li></ul></div>
      <div style="margin-top:8px"><b>Teaching Note</b><br>${JR_REFLECTION_PROMPTS.final.note}</div>
    `);
  }
}


function isTeacherJrMode(){
  const params = new URLSearchParams(window.location.search);
  if(params.get('teacher') === '1') return true;
  try{ return sessionStorage.getItem('wglt_jr_role') === 'teacher'; }catch(err){ return false; }
}

function getReflectionPackForChoice(opt){
  if(!opt) return JR_REFLECTION_PROMPTS.default;
  if((opt.share || 0) > 0) return JR_REFLECTION_PROMPTS.share;
  if((opt.save || 0) > 0 && (opt.spend || 0) >= 0) return JR_REFLECTION_PROMPTS.save;
  if((opt.spend || 0) < 0) return JR_REFLECTION_PROMPTS.spend;
  return JR_REFLECTION_PROMPTS.default;
}

function getReflectionTypeForChoice(opt){
  if(!opt) return 'default';
  if((opt.share || 0) > 0) return 'share';
  if((opt.save || 0) > 0 && (opt.spend || 0) >= 0) return 'save';
  if((opt.spend || 0) < 0) return 'spend';
  return 'default';
}

function renderTeacherReflectionBox(html){
  const box = document.getElementById('teacher-reflection-box');
  const content = document.getElementById('teacher-reflection-content');
  if(!box || !content) return;
  if(!isTeacherJrMode()){
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
  content.innerHTML = html;
}

function buildRecentReflectionMarkup(){
  if(!state.reflectionHistory || !state.reflectionHistory.length){
    return '<div class="teacher-mini">No logged reflections yet. After a choice, the question bank for that choice will show up here.</div>';
  }
  return state.reflectionHistory.slice(0,6).map(item => `<div class="teacher-mini">Week ${item.week}: <b>${item.typeLabel}</b> · ${item.question}</div>`).join('');
}

function updateTeacherWeekPrompt(scenario, reflectionType='default'){
  if(!isTeacherJrMode() || !scenario) return;
  const type = reflectionType || state.currentTeacherReflectionType || 'default';
  const pack = JR_REFLECTION_PROMPTS[type] || JR_REFLECTION_PROMPTS.default;
  const monthCheckpoint = state.week > 0 && state.week % 4 === 0
    ? `<div class="teacher-reflection-card"><h5>📅 Month Checkpoint</h5><div class="teacher-reflection-actions">${JR_REFLECTION_PROMPTS.monthly.reflection.map(q => `<button class="teacher-q-btn" type="button" onclick="openTeacherQuestion('${q.replace(/'/g,"&#39;")}', 'monthly')">${q}</button>`).join('')}</div></div>`
    : '';
  renderTeacherReflectionBox(`
    <div class="teacher-reflection-grid">
      <div class="teacher-reflection-card">
        <h5>💬 Teacher Prompt</h5>
        <div>${pack.discussion}</div>
        <div class="teacher-mini" style="margin-top:8px">Teacher Mode add-on: <b>What would you tell a friend to do here?</b></div>
      </div>
      <div class="teacher-reflection-card">
        <h5>📝 Click a reflection question for the class</h5>
        <div class="teacher-reflection-actions">${pack.reflection.map(q => `<button class="teacher-q-btn" type="button" onclick="openTeacherQuestion('${q.replace(/'/g,"&#39;")}', '${type}')">${q}</button>`).join('')}</div>
      </div>
      <div class="teacher-reflection-card">
        <h5>📚 Full reflection library</h5>
        <div class="teacher-mini"><b>Spend</b></div><div class="teacher-reflection-actions">${JR_REFLECTION_PROMPTS.spend.reflection.slice(0,4).map(q => `<button class="teacher-q-btn" type="button" onclick="openTeacherQuestion('${q.replace(/'/g,"&#39;")}', 'spend')">${q}</button>`).join('')}</div>
        <div class="teacher-mini" style="margin-top:8px"><b>Save</b></div><div class="teacher-reflection-actions">${JR_REFLECTION_PROMPTS.save.reflection.slice(0,4).map(q => `<button class="teacher-q-btn" type="button" onclick="openTeacherQuestion('${q.replace(/'/g,"&#39;")}', 'save')">${q}</button>`).join('')}</div>
        <div class="teacher-mini" style="margin-top:8px"><b>Share</b></div><div class="teacher-reflection-actions">${JR_REFLECTION_PROMPTS.share.reflection.slice(0,4).map(q => `<button class="teacher-q-btn" type="button" onclick="openTeacherQuestion('${q.replace(/'/g,"&#39;")}', 'share')">${q}</button>`).join('')}</div>
        <div class="teacher-mini" style="margin-top:8px"><b>General</b></div><div class="teacher-reflection-actions">${JR_REFLECTION_PROMPTS.default.reflection.map(q => `<button class="teacher-q-btn" type="button" onclick="openTeacherQuestion('${q.replace(/'/g,"&#39;")}', 'default')">${q}</button>`).join('')}</div>
      </div>
      <div class="teacher-reflection-card">
        <h5>🧾 Recent reflection log</h5>
        ${buildRecentReflectionMarkup()}
      </div>
      ${monthCheckpoint}
    </div>
  `);
}

function openTeacherReflectionModal(opt, scenario){
  return;
}

// ══════════════════════════════════════════════════════════════════
// TEACHER TOOLS
// ══════════════════════════════════════════════════════════════════
function teacherTriggerBonus() {
  if (!state.gameActive) return;
  earnMoney(5, 'Teacher Bonus Payday! 🎉', '🎉');
  showConsequenceBanner('🎉', 'Bonus Payday!', 'The teacher gave everyone $5 extra! A reminder: unexpected money = opportunity to save or share more!');
  document.getElementById('teacher-info').textContent =
    'FL Standard #1 (Earning Income): Discuss — where does money come from? Is bonus money different from earned money?';
}

function teacherTriggerExpense() {
  if (!state.gameActive) return;
  const amt = 3;
  state.jars.spend = Math.max(0, state.jars.spend - amt);
  addLedger('expense','⚠️','Surprise expense!','−$'+amt);
  updateJars(); updateHeader();
  showConsequenceBanner('⚠️','Surprise Expense!','A $3 unexpected expense came up — like a broken item or a surprise fee. This is why we keep money in our Spend jar!');
  document.getElementById('teacher-info').textContent =
    'FL Standard #3 (Saving) & #11 (Financial Decisions): Discuss — why do we need savings for surprises? What would happen if the jar was empty?';
}

function teacherDiscussion() {
  const monthExtra = state.week > 0 && state.week % 4 === 0
    ? '\n\n📅 Month Check: What pattern do you notice in the jars this month? What would you change before the next month starts?'
    : '';
  showModal('💬','Discussion Time!',
    'Ask the class:\n\n' +
    '1️⃣ Which jar do you wish was bigger right now?\n' +
    '2️⃣ Was it hard to save instead of spend this week?\n' +
    '3️⃣ How does it feel to see your Save jar growing?\n' +
    '4️⃣ What would happen if we spent from the Save jar?' + monthExtra,
    'Resume Game ▶️', closeModal
  );
}

function teacherShowBuckets() {
  showModal('📋','Florida Standards Covered',
    'This game covers:\n\n' +
    '✅ Benchmark #1 — Earning Income\n' +
    '✅ Benchmark #2 — Spending (needs vs. wants)\n' +
    '✅ Benchmark #3 — Saving toward a goal\n' +
    '✅ Benchmark #7 — Budgeting (3-jar method)\n' +
    '✅ Benchmark #11 — Financial Decisions\n\n' +
    'Each weekly choice card connects to at least 2 of these standards.',
    'Got it! 👍', closeModal
  );
}

// ══════════════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════════════
function spawnJarDelta(jarKey, delta){
  if(!delta) return;
  const wrap = document.querySelector('.jar-wrap.jar-' + jarKey);
  if(!wrap) return;
  const el = document.createElement('div');
  el.className = 'jar-delta-pop ' + (delta > 0 ? 'plus' : 'minus');
  el.textContent = (delta > 0 ? '+' : '') + fmt(delta);
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function updateJars() {
  const prev = state._lastJarSnapshot || {spend:0, save:0, share:0};
  const MAX = Math.max(100, state.goal || 0, state.jars.spend, state.jars.save, state.jars.share);
  ['spend','save','share'].forEach(j => {
    const pct = Math.min(100, (state.jars[j]/MAX)*100);
    const fillEl = document.getElementById('jar-'+j+'-fill');
    fillEl.style.height = pct + '%';
    fillEl.title = '$' + fmt(state.jars[j]) + ' out of visual max $' + fmt(MAX);
    document.getElementById('jar-'+j+'-amt').textContent = '$' + fmt(state.jars[j]);
    const delta = state.jars[j] - (prev[j] || 0);
    if (delta !== 0) {
      fillEl.classList.remove('jar-pulse');
      void fillEl.offsetWidth;
      fillEl.classList.add('jar-pulse');
      spawnJarDelta(j, delta);
      setTimeout(() => fillEl.classList.remove('jar-pulse'), 700);
    }
  });
  state._lastJarSnapshot = { ...state.jars };
  // Goal bar
  const pct = Math.min(100, (state.jars.save / state.goal)*100);
  document.getElementById('goal-fill').style.width = pct + '%';
  document.getElementById('goal-progress-text').textContent =
    '$' + fmt(state.jars.save) + ' / $' + state.goal;
  syncEarnedIncomeLabel();

  // Celebrate goal hit
  if (state.jars.save >= state.goal && !state._goalCelebrated) {
    state._goalCelebrated = true;
    setTimeout(() => {
      launchConfetti(30);
      showModal('🏆','You Hit Your Goal!',
        'Your Save jar reached $' + state.goal + '! 🎉\n\nYou practiced one of the most important money skills: saving toward something you really want. Keep going!',
        'Keep saving! 💪', closeModal
      );
    }, 600);
  }
}

function updateHeader() {
  const total = state.jars.spend + state.jars.save + state.jars.share;
  document.getElementById('hdr-week').textContent  = state.week + '/' + TOTAL_WEEKS;
  document.getElementById('hdr-total').textContent = '$' + fmt(total);
  document.getElementById('hdr-saved').textContent = '$' + fmt(state.jars.save);
}

function updateProgressBar() {
  const pct = (state.week / TOTAL_WEEKS) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-label').textContent = 'Week ' + state.week + ' of ' + TOTAL_WEEKS;
  document.getElementById('progress-emoji').textContent = WEEK_EMOJIS[state.week - 1] || '🌟';
}

function addLedger(type, emoji, text, amount) {
  const el = document.createElement('div');
  el.className = 'ledger-entry ' + type;
  el.innerHTML = `<span class="l-emoji">${emoji}</span>
    <span class="l-text">${text}</span>
    <span class="l-amount">${amount}</span>`;
  const container = document.getElementById('ledger-entries');
  container.insertBefore(el, container.firstChild);
  // Trim to 20 entries
  while (container.children.length > 20) container.removeChild(container.lastChild);
}

function showConsequenceBanner(emoji, title, body) {
  const b = document.getElementById('consequence-banner');
  document.getElementById('cb-emoji').textContent = emoji;
  document.getElementById('cb-title').textContent = title;
  document.getElementById('cb-body').textContent  = body;
  b.style.display = 'flex';
  scrollTop();
}
function hideConsequenceBanner() {
  document.getElementById('consequence-banner').style.display = 'none';
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showModal(emoji, title, body, btnText, onClose) {
  document.getElementById('modal-emoji').textContent = emoji;
  document.getElementById('modal-title').textContent = title;
  // Handle newlines
  document.getElementById('modal-body').innerHTML = body.replace(/\n/g,'<br>');
  document.getElementById('modal-btn').textContent = btnText || 'OK';
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modal-btn').onclick = () => { closeModal(); if(onClose) onClose(); };
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

function animateCoin() {
  const coin = document.createElement('div');
  coin.className = 'flying-coin';
  coin.textContent = '🪙';
  coin.style.left = (40 + Math.random()*60) + '%';
  coin.style.top  = '30%';
  coin.style.setProperty('--dx', (Math.random()*60-30)+'px');
  coin.style.setProperty('--dy', (-60-Math.random()*40)+'px');
  coin.style.setProperty('--dx2',(Math.random()*100-50)+'px');
  coin.style.setProperty('--dy2',(-20)+'px');
  document.body.appendChild(coin);
  setTimeout(()=>coin.remove(), 700);
}

function launchConfetti(count=80) {
  const colors = ['#FFB800','#F4633A','#5DBB63','#4AABDB','#7B5EA7','#2CC4A0'];
  for (let i=0;i<count;i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left  = Math.random()*100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    piece.style.width  = (6+Math.random()*8)+'px';
    piece.style.height = (6+Math.random()*8)+'px';
    piece.style.animationDuration = (1.5+Math.random()*2)+'s';
    piece.style.animationDelay = Math.random()*1+'s';
    document.body.appendChild(piece);
    setTimeout(()=>piece.remove(), 4000);
  }
}

function scrollTop() {
  window.scrollTo({top:0, behavior:'smooth'});
}

function fmt(n) {
  return (Math.round(n * 10)/10).toFixed(0);
}

function resetGame() {
  state = {
    playerName:'', avatar:'', avatarName:'',
    job:null, cause:null, causeName:'', goal:20,
    week:0, jars:{spend:0,save:0,share:0},
    totalEarned:0, pendingConsequences:[],
    boughtItems:{}, choiceMade:false,
    gameActive:false, finalReached:false,
  };
  document.querySelectorAll('.job-card').forEach(c=>c.classList.remove('selected'));
  document.querySelectorAll('.cause-btn').forEach(b=>b.classList.remove('selected'));
  document.querySelectorAll('.goal-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('start-btn').disabled = true;
  document.getElementById('week-progress').style.display = 'none';
  document.getElementById('header-logo').style.display = '';
  document.getElementById('header-avatar').style.display = 'none';
  document.getElementById('ledger-entries').innerHTML =
    '<div class="ledger-entry event"><span class="l-emoji">🌟</span><span class="l-text">Game started! Good luck!</span><span class="l-amount"></span></div>';
  hydrateSharedProfileUI();
updateResumeButton();
syncEarnedIncomeLabel();
  clearSavedGame();
  showScreen('screen-welcome');
}

function confirmResetGame(){
  showModal('🔁','Reset Budget Boss Jr?',
    'This will restart the current Jr game and take you back to the welcome screen. Your saved player name and avatar will stay unless you choose the clear option.',
    'Reset Now', resetGame
  );
}

function clearProfileAndReset(){
  showModal('🗑️','Clear Saved Player?',
    'This will delete the saved player name and avatar for Budget Boss Jr and restart the game fresh.',
    'Delete + Reset', ()=>{ clearSharedProfile(); resetGame(); }
  );
}

// ── Cloud animation re-randomize on load ──
document.querySelectorAll('.cloud').forEach(c=>{
  c.style.top = (5+Math.random()*50)+'%';
  c.style.animationDelay = -(Math.random()*30)+'s';
});

(function(){
  const params = new URLSearchParams(window.location.search);
  const teacherPanel = document.getElementById('teacher-panel');
  const teacherOn = params.get('teacher') === '1' || (function(){ try{ return sessionStorage.getItem('wglt_jr_role') === 'teacher'; }catch(err){ return false; }})();
  if(teacherPanel && teacherOn) teacherPanel.style.display = '';
  if(teacherOn) renderTeacherReflectionBox('<div><b>Teacher mode ready.</b><br>Click a question in the reflection area to show it to the class.</div>');
})();


function hydrateSharedProfileUI(){
  const profile = loadSharedProfile();
  document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
  const inp = document.getElementById('player-name-input');
  if(inp) inp.value = '';
  if(!profile){
    updateHeaderAvatar();
    checkStartReady();
    return;
  }
  if(profile.playerName){
    state.playerName = profile.playerName;
    if(inp) inp.value = profile.playerName;
  }
  if(profile.avatar){
    state.avatar = profile.avatar;
    state.avatarName = profile.avatarName || '';
    document.querySelectorAll('.avatar-btn').forEach(b => {
      if (b.querySelector('.av-emoji') && b.querySelector('.av-emoji').textContent === profile.avatar) {
        b.classList.add('selected');
      }
    });
  }
  updateHeaderAvatar();
  checkStartReady();
}

hydrateSharedProfileUI();
updateResumeButton();
syncEarnedIncomeLabel();

