import config from "@src/core/config";
import { signal } from "@src/data/signal";


export function determineAction(): void {
    switch (config.defaultAction) {
        case 0:
            // A custom action written by the client
            signal(config.customAction);
            break;
        case 1:
            signal(showDialog);
            break;
        case 2:
            signal(showAlert);
            break;
        default:
            signal(null);
            break;
    }
}

function showAlert(): void {
    // Shows a blocking warning
    var str: string = "It seems you might be facing some troubles. Please contact us at: ";
    if (config.liveSignalsActionParams?.length > 0)
    {
        // The client email for example
        str += config.liveSignalsActionParams[0];
    }
    alert(str);
}

function showDialog(): void {
    // This function may be further optimized and cleaned up
    try {
        // Tries to get the dialog element if it exists
        const dialog = document.getElementById("zdialog") as HTMLDialogElement;     // using a weird ID to avoid potential conflict with existing IDs
        var str: string = "It seems you might be facing some troubles. Please contact us at: ";
        if (config.liveSignalsActionParams?.length > 0)
        {
            // possibly the email
            str += config.liveSignalsActionParams[0];
        }
        dialog.innerHTML = str;
        
        var lightmode : boolean = false;
        if (config.liveSignalsActionParams?.length > 1)
        {
            lightmode = (config.liveSignalsActionParams[1].toLowerCase() == "true")? true : false;
        }

        styleDialog(dialog, lightmode);
        dialog.style.display = "block";
    } catch (err) {
        // If not, creates a new dialog element
        const dialog = document.createElement("dialog") as HTMLDialogElement;
        // dialog.innerHTML = "Non-Blocking test dialog 2";
        var str: string = "It seems you might be facing some troubles. Please contact us at: ";
        if (config.liveSignalsActionParams?.length > 0)
        {
            str += config.liveSignalsActionParams[0];
        }
        dialog.innerHTML = str;
        var lightmode : boolean = false;
        if (config.liveSignalsActionParams?.length > 1)
        {
            lightmode = (config.liveSignalsActionParams[1].toLowerCase() == "true")? true : false;
        }
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
      dialog.style.border = "2px solid #ddd"; // Thicker border in light mode
    } else {
      dialog.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
      dialog.style.color = "#fff";
      dialog.style.border = "2px solid #666"; // Thicker border in dark mode
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