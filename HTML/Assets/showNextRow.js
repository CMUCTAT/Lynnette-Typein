document.addEventListener('tutorInitialized',
    (e) => {
        CTATCommShell.commShell.addGlobalEventListener({
            processCommShellEvent: function(e, msg) {
                if (e == 'CorrectAction' || e == 'InCorrectAction') {
                    showNextRow();
                }
            }
        });
    }
);