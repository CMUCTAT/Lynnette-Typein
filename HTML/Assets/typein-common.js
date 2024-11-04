let currentRow = 0

const searchParams = new URL(window.location).searchParams,
      templates = searchParams.get('templates'),
      style = searchParams.get('style')
if (templates) window.templates = templates
if (style) document.documentElement.setAttribute('id', style)

function showNextRow() {
  console.log('showNextRow', currentRow)
  let panel = document.getElementById('middlePanel'),
      template = document.getElementById('rowTemplate'),
      row = template.content.firstElementChild.cloneNode(true),
      group = row.firstElementChild,
      input = group.getElementsByClassName('CTATMathInput')[0]
  console.log(panel, row, group)
  group.id = `solve${++currentRow}Group`
  input.id = `solve${currentRow}`
  group.getElementsByClassName('feedback')[0].id = `solve${currentRow}Feedback`
  panel.insertBefore(row, template)
  input.focus()
}

tutorInitializer.then(() => {
  updateDone()
  addFeedbackListener()
  addHintWindowListener()
  addSkillListener()
})

function updateDone() {
  document.getElementById('doneButton').getElementsByClassName('CTAT-done-button--text')[0].innerHTML = 'Finish Problem'
}

function addFeedbackListener() {
  CTATCommShell.commShell.addGlobalEventListener({
    processCommShellEvent(event, message) {
      if (event == 'AssociatedRules' && message) {
        let indicator = message.getIndicator(),
            sai = message.getSAI(),
            selection = (sai ? sai.getSelection() : '_noSuchComponent_'),
            selectionElement = document.getElementById(selection)
        if (selectionElement && selectionElement.classList.contains('CTATMathInput'))
          window.setTimeout(delayIndicator, 700, selection, indicator)
      }
    }
  })
}

function delayIndicator(selection, indicator) {
  let indicatorBox = document.getElementById(selection + 'Feedback'),
      currentIndicatorElement = indicatorBox.firstChild,
      newIndicatorElement = document.createElement('span')
  if (indicator == 'Hint') {
    newIndicatorElement.innerHTML = '?'
    newIndicatorElement.classList.add('cross')
  } else if (indicator == 'InCorrect') {
    newIndicatorElement.innerHTML = '&#10005'
    newIndicatorElement.classList.add('cross')
  } else if (indicator == 'Correct') {
    newIndicatorElement.innerHTML = '&#10003'
    newIndicatorElement.classList.add('tick')
  }
  if (!currentIndicatorElement) indicatorBox.appendChild(newIndicatorElement)
  else indicatorBox.replaceChild(newIndicatorElement, currentIndicatorElement)
}

function addHintWindowListener() {
  CTATCommShell.commShell.addGlobalEventListener({
    processCommShellEvent(event, message) {
      if (event == 'AssociatedRules' && message) {
        let hintWindow = document.getElementById('HintWindow')
        hintWindow.style.display = message.getProperty('TutorAdvice') ? 'flex' : 'none'
        hintWindow.scrollIntoView(false)
      }
      if (event == 'InterfaceAction' && message && typeof message == 'object') {
        let sai = message.getSAI(),
            selection = (sai ? sai.getSelection() : '_noSuchComponent_')
        if (sai.getAction() == 'SetVisible')
          document.getElementById(selection).style.display = 'flex'
      }
    }
  })
}

CTATExampleTracerSkill.prototype.clone = function() {
  let clone = new CTATExampleTracerSkill(this.getCategory(), this.getName(), this.getPGuess(), this.getPKnown(),
                                         this.getPSlip(), this.getPLearn(), this.getHistory(), this.getOpportunityCount())
  clone.setLabel(this.getLabel())
  clone.setDescription(this.getDescription())
  return clone
}

function addSkillListener() {
  let initialSkills = [], previousSkills = [], currentSkills = null
  CTATCommShell.commShell.addGlobalEventListener({
    processCommShellEvent(event, message) {
      if (event == 'StartProblem') {
        currentSkills = CTAT.ToolTutor.tutor.getProblemSummary().getSkills()
        if (currentSkills) {
          initialSkills = currentSkills.getAllSkills().map((skill) => skill.clone())
          previousSkills = currentSkills.getAllSkills().map((skill) => skill.clone())
          setInitialSkills(initialSkills)
        }
      } else if (currentSkills && event == 'AssociatedRules' && message) {
        setInitialSkills(initialSkills)
        let skillUpdates = message.getSkillsObject().getSkillSet(),
            skillLabelElements = document.getElementsByClassName('CTATSkillWindow--label')
        if (skillUpdates.length) {
          previousSkills.forEach(skill => {
            let skillUpdate = skillUpdates.find(skillUpdate =>
                  `${skillUpdate.getSkillName()} ${skillUpdate.getCategory()}` == skill.getSkillName()),
                skillLabelElement = Array.prototype.find.call(skillLabelElements, skillLabelElement =>
                  skillLabelElement.innerHTML == skill.getLabel())
            if (skillUpdate) {
              let skillBarElement = skillLabelElement.previousSibling.firstElementChild
              skillBarElement.style.width = skill.getPKnown() * 100 + '%'
              window.setTimeout(() => {
                skillBarElement.classList.add('transition')
                skillBarElement.style.width = skillUpdate.getLevel() * 100 + '%'
              }, 0)
            } else
              skillLabelElement.parentNode.classList.add('blur')
          })
          window.setTimeout(() => {
            Array.prototype.forEach.call(skillLabelElements, skillLabelElement => {
              skillLabelElement.previousSibling.firstElementChild.classList.remove('transition')
              skillLabelElement.parentNode.classList.remove('blur')
            })
          }, 1000)
          previousSkills = currentSkills.getAllSkills().map((skill) => skill.clone())
        }
      }
    }
  })
}

function setInitialSkills(skills) {
  let skillElementLabels = document.getElementsByClassName('CTATSkillWindow--label')
  skills.forEach(skill => {
    let label = skill.getLabel(),
        initialSkillElement = document.createElement('div')
    initialSkillElement.classList.add('CTATSkillWindow--initial')
    initialSkillElement.style.width = skill.getPKnown() * 100 + '%'
    Array.prototype.find.call(skillElementLabels, labelElement => labelElement.innerHTML == label).
      previousSibling.append(initialSkillElement)
  })
}
