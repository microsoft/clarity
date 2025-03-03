export var iframeUnavailable = `iframe[data-clarity-unavailable] {
  /* Variant=iFrame, Size=Large, State=Default */

    box-sizing: border-box;

    /* Auto layout */
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 16px;
    isolation: isolate;

    position: absolute;
    width: 138px;
    height: 169px;
    left: 20px;
    top: 398px;

    background: #FBFBFE;
    /* Accent/Tropical Indigo/Primary */
    border: 1px dashed #827DFF;
    /* Card shadow back */
    box-shadow: 0px 0.6px 1.8px rgba(131, 126, 255, 0.1), 0px 3.2px 7.2px rgba(131, 126, 255, 0.12);


    /* Line 1 */

    position: absolute;
    left: 0px;
    right: -80.19px;
    top: 0px;
    bottom: 169px;

    /* Accent/Tropical Indigo/Primary */
    border: 1px dashed #827DFF;
    transform: matrix(0.63, 0.77, -0.53, 0.85, 0, 0);

    /* Inside auto layout */
    flex: none;
    order: 0;
    flex-grow: 0;
    z-index: 0;


    /* Line 2 */

    position: absolute;
    left: 138px;
    right: -218.19px;
    top: 0px;
    bottom: 169px;

    /* Accent/Tropical Indigo/Primary */
    border: 1px dashed #827DFF;
    transform: matrix(-0.63, 0.77, -0.53, -0.85, 0, 0);

    /* Inside auto layout */
    flex: none;
    order: 1;
    flex-grow: 0;
    z-index: 1;


    /* Message */

    /* Auto layout */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 8px;
    gap: 8px;

    width: 106px;
    height: 112px;

    background: #FBFBFE;

    /* Inside auto layout */
    flex: none;
    order: 2;
    flex-grow: 1;
    z-index: 2;


    /* Window Header Horizontal Off

    Keyword: fluent-icon;
    Metaphor: rectangle, shape, web, app, window, UI;

    Used to represent general windowed app scenarios.
    */

    width: 24px;
    height: 24px;


    /* Inside auto layout */
    flex: none;
    order: 0;
    flex-grow: 0;


    /* Shape */

    position: absolute;
    width: 19.2px;
    height: 19.2px;
    left: calc(50% - 19.2px/2 + 0px);
    top: calc(50% - 19.2px/2 - 0px);

    /* Accent/Tropical Indigo/Dark */
    background: #020057;


    /* Clarity can’t track embedded iFrames */

    width: 90px;
    height: 64px;

    /* Web/Caption 1

    Caption
    */
    font-family: 'Segoe UI';
    font-style: normal;
    font-weight: 400;
    font-size: 12px;
    line-height: 16px;
    /* or 133% */
    text-align: center;

    /* Accent/Tropical Indigo/Dark */
    color: #020057;


    /* Inside auto layout */
    flex: none;
    order: 1;
    align-self: stretch;
    flex-grow: 0;
}`