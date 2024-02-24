var currentRow = 0
var pathSelected = null;
var masteredSkills;

const AUTO_SOLVE_MSG = "Because you have demonstrated the knowledge needed to complete the remaining steps, I have finished the problem for you.  You can review what I've done, or click \"Finish Problem\" to advance."


function takeStep(step) {
  let selection = step.selection;
  let action = "UpdateTextField";
  let input = step.input;
  let ctatSAI = new CTATSAI(selection, action, input),
  stepType = "ATTEMPT";
  console.log(
    "\tsend sai: " +
      selection +
      "," +
      action +
      "," +
      input +
      ", (" +
      "tutored)"
  );
  CTATCommShell.commShell.processComponentAction(
    ctatSAI, //sai
    true, //tutored
    true, //behavior recorded
    null, //[deprecated]
    stepType, //log type
    null, //aTrigger
  );
}

function getFieldNumber(field) {
  return Number(field.getName().replace("solve",""));
}

function assignSelections(path) {  
  let fields = CTATShellTools.getAllComponents().filter((c)=>c.getClassName() === "CTATMathInput" && !c.getValue())
    .sort((a, b)=>getFieldNumber(a) - getFieldNumber(b));
  path.forEach((step, idx) => {
    step.selection = fields[idx].getName();
  });
}

function followPath(path) {
  console.log("followPath: ",path);
  assignSelections(path);
  path.forEach(takeStep);
}

function updateMasteredSkills() {
  let allSkills = CTAT.ToolTutor.tutor.getProblemSummary().getSkills().toJSONforTutorshop();
  masteredSkills = allSkills.filter((s)=> s.p_known >= 0.95);
  console.log("all skills are ",allSkills.map((s)=>s.name));
  console.log("mastered skills are ",masteredSkills.map((s)=>s.name));
}

function showNextRow() {
  document.getElementById(`solve${++currentRow}Group`).parentNode.style.display = 'flex'
}

tutorInitializer.then(() => {
  updateDone()
  addMessageListener();
  updateMasteredSkills();
})

function updateDone() {
  document.getElementById('doneButton').getElementsByClassName('CTAT-done-button--text')[0].innerHTML = 'Finish Problem'
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

function handleAssociatedRules(message) {
  if(message) {
    
    let indicator = message.getIndicator(),
      sai = message.getSAI(),
      selection = (sai ? sai.getSelection() : '_noSuchComponent_'),
      selectionElement = document.getElementById(selection)
    
    if (pathSelected && (selection === pathSelected[pathSelected.length-1].selection)) {
      //last step, show message
      console.log("last step");
      document.getElementById('HintWindow').style.display = 'flex';
      CTATShellTools.showHints([AUTO_SOLVE_MSG]);
    } else {
      document.getElementById('HintWindow').style.display = message.getProperty('TutorAdvice') ? 'flex' : 'none'
    }
    
    if (selectionElement && selectionElement.classList.contains('animate')) {
      window.setTimeout(delayIndicator, 700, selection, indicator)
    }
  }
}

function handleInterfaceAction(message) {
  if (message && typeof message == 'object') {
    let sai = message.getSAI(),
        selection = (sai ? sai.getSelection() : '_noSuchComponent_')
    if (sai.getAction() == 'SetVisible') {
      document.getElementById(selection).style.display = 'flex'
    }
  }
}

function handleCorrectAction(message) {
  console.log("correct action, solution paths are now: ",window._solutionPaths);
  const masteredPaths = [];
  if (window._solutionPaths?.length && !pathSelected) {
    window._solutionPaths.forEach((sp, idx) => {
      const skills = [...new Set(sp.map((s)=>s.skill))];
      console.log("\tskills for path "+idx+": ",skills);
      if (skills.every((s)=>masteredSkills.find(ms => ms.name === s))) {
        console.log("\tall skills mastered for this path");
        masteredPaths.push(sp);
      }
    });

    if (masteredPaths.length === window._solutionPaths.length) {
      console.log("no paths with unmastered skills");
      pathSelected = masteredPaths[0];
      followPath(masteredPaths[0]);
    }
  }
}

function addMessageListener() {
  CTATCommShell.commShell.addGlobalEventListener({
    processCommShellEvent: function(event, message) {
      switch (event) {
        case 'CorrectAction':
          handleCorrectAction(message);
        case 'InCorrectAction':
          updateMasteredSkills();
          break;
        case 'AssociatedRules': 
          handleAssociatedRules(message);
          break;
        case 'InterfaceAction':
          handleInterfaceAction(message);
          break;
      }
    }
  });
}