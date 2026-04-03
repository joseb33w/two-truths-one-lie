import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

(() => {
  try {
    const SUPABASE_URL = 'https://xhhmxabftbyxrirvvihn.supabase.co'
    const SUPABASE_ANON_KEY = 'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
    const ROUNDS_TABLE = 'uNMexs7BYTXQ2_two_truths_one_lie_rounds'
    const GUESSES_TABLE = 'uNMexs7BYTXQ2_two_truths_one_lie_guesses'
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const roundForm = document.getElementById('roundForm')
    const statementOne = document.getElementById('statementOne')
    const statementTwo = document.getElementById('statementTwo')
    const statementThree = document.getElementById('statementThree')
    const submitBtn = document.getElementById('submitBtn')
    const formStatus = document.getElementById('formStatus')
    const roundsContainer = document.getElementById('roundsContainer')
    const gameStatus = document.getElementById('gameStatus')
    const refreshBtn = document.getElementById('refreshBtn')
    const correctCount = document.getElementById('correctCount')
    const totalCount = document.getElementById('totalCount')

    function setFormStatus(message, tone = 'neutral') {
      formStatus.textContent = message
      formStatus.style.color = tone === 'success' ? '#bbf7d0' : tone === 'error' ? '#fecaca' : '#a8b0c4'
      formStatus.style.borderColor = tone === 'success'
        ? 'rgba(34, 197, 94, 0.35)'
        : tone === 'error'
          ? 'rgba(239, 68, 68, 0.35)'
          : 'rgba(255, 255, 255, 0.08)'
      formStatus.style.background = tone === 'success'
        ? 'rgba(34, 197, 94, 0.12)'
        : tone === 'error'
          ? 'rgba(239, 68, 68, 0.12)'
          : 'rgba(255, 255, 255, 0.04)'
    }

    function setGameStatus(message) {
      gameStatus.textContent = message
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    function getLieIndex() {
      const selected = document.querySelector('input[name="lieIndex"]:checked')
      return selected ? Number(selected.value) : 0
    }

    function getStatementsFromRound(round) {
      return [round.statement_one, round.statement_two, round.statement_three]
    }

    function validateStatements(statements) {
      return statements.every((item) => item.trim().length >= 4)
    }

    async function ensureSession() {
      try {
        const { data: existing, error: existingError } = await supabase.auth.getSession()
        if (existingError) throw existingError
        if (existing.session) return existing.session

        const email = `guest_${crypto.randomUUID()}@twotruthsonelie.app`
        const password = `${crypto.randomUUID()}Aa!42`

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'https://sling-gogiapp.web.app/email-confirmed.html'
          }
        })

        if (signUpError && !String(signUpError.message).toLowerCase().includes('already registered')) {
          throw signUpError
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (signInError) throw signInError
        return signInData.session
      } catch (error) {
        console.error('Session error:', error.message, error.stack)
        throw new Error('Could not start a guest session. Please refresh and try again.')
      }
    }

    async function loadScore() {
      try {
        await ensureSession()
        const { data, error } = await supabase
          .from(GUESSES_TABLE)
          .select('is_correct')
          .order('created_at', { ascending: false })

        if (error) throw error

        const total = data.length
        const correct = data.filter((item) => item.is_correct).length
        correctCount.textContent = String(correct)
        totalCount.textContent = String(total)
      } catch (error) {
        console.error('Score load error:', error.message, error.stack)
        correctCount.textContent = '0'
        totalCount.textContent = '0'
      }
    }

    function createResultBanner(isCorrect, lieIndex) {
      const banner = document.createElement('div')
      banner.className = `result-banner ${isCorrect ? 'success' : 'error'}`
      banner.innerHTML = `
        <span class="result-icon">${isCorrect ? '✓' : '✕'}</span>
        <span>${isCorrect ? 'Correct!' : `Not quite. Statement ${lieIndex + 1} was the lie.`}</span>
      `
      return banner
    }

    async function handleGuess(round, guessedIndex, card, buttonGroup) {
      try {
        await ensureSession()
        const statements = getStatementsFromRound(round)
        const isCorrect = guessedIndex === round.lie_index

        buttonGroup.querySelectorAll('.statement-btn').forEach((button, index) => {
          button.disabled = true
          button.classList.remove('correct', 'wrong')
          if (index === round.lie_index) {
            button.classList.add('correct')
          } else if (index === guessedIndex && !isCorrect) {
            button.classList.add('wrong')
          }
        })

        const { error } = await supabase.from(GUESSES_TABLE).insert({
          round_id: round.id,
          guessed_index: guessedIndex,
          is_correct: isCorrect
        })

        if (error) throw error

        const existingBanner = card.querySelector('.result-banner')
        if (existingBanner) existingBanner.remove()
        card.appendChild(createResultBanner(isCorrect, round.lie_index))
        await loadScore()
        setGameStatus(`Loaded ${document.querySelectorAll('.round-card').length} rounds.`)
      } catch (error) {
        console.error('Guess error:', error.message, error.stack)
        setGameStatus('Could not save your guess. Please try again.')
      }
    }

    function renderRounds(rounds) {
      roundsContainer.innerHTML = ''

      if (!rounds.length) {
        roundsContainer.innerHTML = '<div class="empty-state">No rounds yet. Be the first to submit one.</div>'
        setGameStatus('No rounds available yet.')
        return
      }

      const fragment = document.createDocumentFragment()

      rounds.forEach((round, roundIndex) => {
        const card = document.createElement('article')
        card.className = 'round-card'

        const title = document.createElement('h3')
        title.textContent = `Round ${roundIndex + 1}`
        card.appendChild(title)

        const list = document.createElement('div')
        list.className = 'statement-list'

        getStatementsFromRound(round).forEach((statement, index) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'statement-btn'
          button.innerHTML = `<span class="statement-number">${index + 1}</span>${escapeHtml(statement)}`
          button.addEventListener('click', () => {
            try {
              if (card.querySelector('.result-banner')) return
              handleGuess(round, index, card, list)
            } catch (error) {
              console.error('Guess click error:', error.message, error.stack)
            }
          })
          list.appendChild(button)
        })

        card.appendChild(list)
        fragment.appendChild(card)
      })

      roundsContainer.appendChild(fragment)
      setGameStatus(`Loaded ${rounds.length} rounds.`)
    }

    async function loadRounds() {
      try {
        setGameStatus('Loading rounds...')
        await ensureSession()
        const { data, error } = await supabase
          .from(ROUNDS_TABLE)
          .select('id, statement_one, statement_two, statement_three, lie_index, created_at')
          .order('created_at', { ascending: false })
          .limit(24)

        if (error) throw error
        renderRounds(data || [])
      } catch (error) {
        console.error('Round load error:', error.message, error.stack)
        roundsContainer.innerHTML = '<div class="empty-state">Unable to load rounds right now.</div>'
        setGameStatus('Could not load rounds. Please refresh.')
      }
    }

    async function submitRound(event) {
      event.preventDefault()
      try {
        submitBtn.disabled = true
        setFormStatus('Saving your round...')
        await ensureSession()

        const statements = [
          statementOne.value.trim(),
          statementTwo.value.trim(),
          statementThree.value.trim()
        ]

        if (!validateStatements(statements)) {
          throw new Error('Each statement must be at least 4 characters long.')
        }

        const lieIndex = getLieIndex()

        const { error } = await supabase.from(ROUNDS_TABLE).insert({
          statement_one: statements[0],
          statement_two: statements[1],
          statement_three: statements[2],
          lie_index: lieIndex
        })

        if (error) throw error

        roundForm.reset()
        document.querySelector('input[name="lieIndex"][value="0"]').checked = true
        setFormStatus('Round submitted. It is now live in the game feed.', 'success')
        await loadRounds()
      } catch (error) {
        console.error('Submit error:', error.message, error.stack)
        setFormStatus(error.message || 'Could not save your round.', 'error')
      } finally {
        submitBtn.disabled = false
      }
    }

    async function init() {
      try {
        setFormStatus('Write three statements and choose the lie.')
        await ensureSession()
        await Promise.all([loadScore(), loadRounds()])
      } catch (error) {
        console.error('Init error:', error.message, error.stack)
        setFormStatus(error.message || 'App failed to initialize.', 'error')
        setGameStatus('Initialization failed.')
      }
    }

    roundForm.addEventListener('submit', (event) => {
      try {
        submitRound(event)
      } catch (error) {
        console.error('Form submit handler error:', error.message, error.stack)
      }
    })

    refreshBtn.addEventListener('click', () => {
      try {
        loadRounds()
        loadScore()
      } catch (error) {
        console.error('Refresh error:', error.message, error.stack)
      }
    })

    init()
  } catch (error) {
    console.error('App bootstrap error:', error.message, error.stack)
    document.body.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;background:#09090d;color:white;font-family:Inter,sans-serif;padding:24px;">
        <div style="max-width:580px;background:#3b0f19;border:1px solid rgba(255,255,255,0.12);padding:22px;border-radius:20px;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
          <h1 style="margin-top:0;font-size:1.5rem;">Two Truths One Lie failed to load</h1>
          <p style="margin-bottom:0;line-height:1.7;color:#fbcfe8;">${error.message}</p>
        </div>
      </div>
    `
  }
})()
