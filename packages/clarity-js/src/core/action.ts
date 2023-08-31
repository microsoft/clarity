import config from "@src/core/config";
import { signal } from "@src/data/signal";
import { LiveSignalsActionType } from "@clarity-types/data";

export function determineAction(): void {
    switch (config.liveSignalsActionType) {
        case LiveSignalsActionType.NoAction:
            // No action
            signal(null);
            break;
        case LiveSignalsActionType.CustomAction:
            // A custom action written by the client
            signal(config.liveSignalsCustomAction);
            break;
        case LiveSignalsActionType.ContactUsDialogueBox:
            signal(showDialog);
            break;
        case LiveSignalsActionType.ContactUsAlert:
            signal(showAlert);
            break;
        default:
            signal(null);
            break;
    }
}

function showAlert(): void {
    // Shows a blocking warning
    var alertMessage: string = "It seems you might be facing some troubles. Please contact us at: ";
    if ("email" in config.liveSignalsActionConfigs)
    {
        // The client email for example
        alertMessage += config.liveSignalsActionConfigs["email"];
    }
    alert(alertMessage);
}

function showDialog(): void {
    // Shows a non-blocking dialog box
    // This function may be further optimized and cleaned up
    var dialogMessage: string = "It seems you might be facing some troubles. Please contact us at: ";
    if ("email" in config.liveSignalsActionConfigs)
    {
        // The client email for example
        dialogMessage += config.liveSignalsActionConfigs["email"];
    }

    var lightmode : boolean = false;
    if ("lightmode" in config.liveSignalsActionConfigs)
    {
        if (typeof(config.liveSignalsActionConfigs["lightmode"]) == "string")
        {
            lightmode = (config.liveSignalsActionConfigs["lightmode"].toLowerCase() == "true")? true : false;
        }
    }

    try {
        // Tries to get the dialog element if it exists
        const dialog = document.getElementById("zdialog") as HTMLDialogElement;     // using a weird ID to avoid potential conflict with existing IDs
        dialog.innerHTML = dialogMessage;
        styleDialog(dialog, lightmode);
    } catch (err) {
        // If not, creates a new dialog element
        const dialog = document.createElement("dialog") as HTMLDialogElement;
        // dialog.innerHTML = "Non-Blocking test dialog 2";
        dialog.innerHTML = dialogMessage;
        styleDialog(dialog, lightmode);
    }
}
  
function closeDialog(): void {
    // No need to try catch, as this will only be called after
    // showDialog, which means the dialog element exists
    const dialog = document.getElementById("zdialog") as HTMLDialogElement;
    dialog.style.display = "none";
}

function styleDialog(dialog: HTMLDialogElement, lightMode = false): void {
    dialog.style.display = "block";
    dialog.id = "zdialog"; // Choosing a weird name to avoid any potential conflicts with other elements
  
    // Apply common styling
    dialog.style.position = "fixed";
    dialog.style.top = "50%";
    dialog.style.left = "50%";
    dialog.style.transform = "translate(-50%, -50%)";
    dialog.style.margin = "0";
    dialog.style.padding = "20px";
    dialog.style.width = "80%";
    dialog.style.textAlign = "center";
    dialog.style.zIndex = "10000"; // Set the z-index to 10000 to make sure it is on top of everything
  
    // Apply mode-specific styling
    if (lightMode) {
      dialog.style.backgroundColor = "rgba(39, 54, 223, 0.93)";
      dialog.style.color = "rgb(245, 245, 245)";
      dialog.style.border = "2px solid #ddd";
    } else {
      dialog.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
      dialog.style.color = "#fff";
      dialog.style.border = "2px solid #666";
    }
  
    // Create a close button
    const close = document.createElement("button");
    close.innerHTML = "OK";
    close.onclick = closeDialog;
    dialog.appendChild(close);
  
    // Apply styling to the close button
    close.style.backgroundColor = "#4CAF50";
    close.style.color = "#fff";
    close.style.padding = "10px 20px";
    close.style.border = "none";
    close.style.borderRadius = "4px";
    close.style.fontSize = "16px";
    close.style.cursor = "pointer";
    close.style.textShadow = "1px 1px #000";
    close.style.display = "block";
    close.style.margin = "auto";
    close.style.marginTop = "20px";
  
    document.body.appendChild(dialog); // Append dialog to the body element
}