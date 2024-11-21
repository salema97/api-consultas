const { chromium } = require("playwright");

let browser;

const initializeBrowser = async () => {
  if (!browser) {
    browser = await chromium.launch({
      headless: false,
      args: [
        "--disable-gpu",
        "--start-maximized",
        "--blink-settings=imagesEnabled=false",
        "--disable-extensions",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });
  }
};

const ConsultaAduna = async (req, res) => {
  const cedula = req.body.cedula;
  const url = "https://www.aduana.gob.ec/consultacupos/";
  const TIMEOUT_MS = 10000;

  await initializeBrowser();
  const page = await browser.newPage();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(async () => {
      await page.close();
      reject(new Error("Consulta excedió el tiempo límite"));
    }, TIMEOUT_MS);
  });

  const consultaPromise = (async () => {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.click("#exampleRadios1");
      await page.fill("#txtCedula", cedula);
      await page.click("text=Consultar");
      await page.waitForSelector("#dato_cedula");

      const ced = await page.textContent("#dato_cedula");
      const nombre = await page.textContent("#dato_nombre");

      const basicDate = {
        cedula: ced,
        nombre: nombre,
      };

      await page.close();
      return basicDate;
    } catch (error) {
      throw error;
    }
  })();

  try {
    const result = await Promise.race([consultaPromise, timeoutPromise]);
    res.json(result);
  } catch (error) {
    console.error("Error durante la consulta:", error.message);
    if (!page.isClosed()) {
      await page.close();
    }
    res.status(500).json({ error: error.message });
  }
};

process.on("exit", async () => {
  if (browser) {
    await browser.close();
  }
});

const ConsultaCompania = async (req, res) => {
  const cedula = req.body.cedula;
  const url =
    "https://appscvs1.supercias.gob.ec/consultaPersona/consulta_cia_param.zul";
  const TIMEOUT_MS = 15000;

  await initializeBrowser();
  const page = await browser.newPage();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(async () => {
      await page.close();
      reject(new Error("Consulta excedió el tiempo límite"));
    }, TIMEOUT_MS);
  });

  const consultaPromise = (async () => {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.click('label:text("Identificación")');
      const cedulaInput = await page.waitForSelector(".z-combobox-inp");
      await cedulaInput.fill(cedula);
      await cedulaInput.press("Backspace");

      const tablaSelector = ".z-comboitem-text";
      await page.waitForTimeout(800);

      if (await page.isVisible(tablaSelector)) {
        await page.waitForSelector(tablaSelector);
        await page.click(tablaSelector);

        await page.click(".z-button");
        await page.waitForSelector(".z-listitem");

        const listItem = await page.waitForSelector(
          '//tr[@class="z-listitem"]/td[@class="z-listcell"]/div/span[@class="z-label"]'
        );
        await listItem.click();

        const [newPage] = await Promise.all([page.waitForEvent("popup")]);

        await newPage.waitForLoadState("domcontentloaded");
        await newPage.goto(newPage.url());

        await newPage.waitForTimeout(1200);

        const parteConstante = "frmInformacionCompanias:j_idt";
        const elementos = await newPage.$$(`
          //input[contains(@id, "${parteConstante}") and contains(@id, "j_idt")]
        `);

        const valoresElementos = [];
        for (const elemento of elementos) {
          const valor = await elemento.getAttribute("value");
          valoresElementos.push(valor);
        }

        const resultDict = {
          ruc: valoresElementos[1],
          fecha_constitucion: valoresElementos[2],
          nacionalidad: valoresElementos[3],
          detalle_ubicacion: {
            provincia: valoresElementos[6]?.trim(),
            canton: valoresElementos[7]?.trim(),
            ciudad: valoresElementos[8]?.trim(),
            parroquia: valoresElementos[9]?.trim(),
            calle: valoresElementos[10]?.trim(),
          },
          detalle_contacto: {
            celular: valoresElementos[23],
            telefono_1: valoresElementos[24]?.trim(),
            correo_1: valoresElementos[27]?.trim(),
            correo_2: valoresElementos[28]?.trim(),
          },
        };

        await newPage.close();
        res.json(resultDict);
      } else {
        res.json({});
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({});
    } finally {
      await page.close();
    }
  })();

  try {
    const result = await Promise.race([consultaPromise, timeoutPromise]);
    res.json(result);
  } catch (error) {
    console.error("Error durante la consulta:", error.message);
    res.status(500).json({ error: error.message });
  }
};

process.on("exit", async () => {
  if (browser) {
    await browser.close();
  }
});

const ConsultaPredial = async (req, res) => {
  const cedula = req.body.cedula;
  const url = "http://186.46.158.7/portal_EC/latacunga.php";
  const TIMEOUT_MS = 15000;

  await initializeBrowser();
  const page = await browser.newPage();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(async () => {
      await page.close();
      reject(new Error("Consulta excedió el tiempo límite"));
    }, TIMEOUT_MS);
  });

  const consultaPromise = (async () => {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.waitForSelector("#map");
      await page.evaluate(() => {
        const mapElement = document.querySelector("#map");
        if (mapElement) mapElement.remove();
      });

      await page.click("text=Cedula/Ruc");
      await page.fill('input[placeholder="2. Ingrese información"]', cedula);
      await page.click("text=Buscar");

      await page.waitForTimeout(200);

      if (!(await page.isVisible(".swal2-header"))) {
        await page.waitForSelector("#prediosCiu");
        await page.waitForSelector("#rpt_prediocatas1");

        const htmlContent = await page.content();
        const { JSDOM } = require("jsdom");
        const { window } = new JSDOM(htmlContent);
        const { document } = window;

        const datosCiu = [
          ...document.querySelectorAll("#prediosCiu tr td:first-child"),
        ]
          .map((td) => td.textContent.trim())
          .slice(1);

        const datosPredio = [
          ...document.querySelectorAll("#rpt_prediocatas1"),
        ].map((element) => element.textContent.trim());

        await page.close();
        return res.json(generarJsonPredial(datosPredio, datosCiu));
      } else {
        await page.close();
        return res.json({});
      }
    } catch (error) {
      if (!page.isClosed()) {
        await page.close();
      }
      throw error;
    }
  })();

  try {
    const result = await Promise.race([consultaPromise, timeoutPromise]);
    return result;
  } catch (error) {
    console.error("Error durante la consulta:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

const generarJsonPredial = (dataList, numList) => {
  if (dataList.length !== 0) {
    const claveCatastralData = dataList[0] || "";
    const claveCatastralMatch = claveCatastralData.match(
      /CLAVE CATASTRAL:\s*([^\s]+)/
    );
    const zonaMatch = claveCatastralData.match(/ZONA:\s*([^\s]+)/);
    const areaMatch = claveCatastralData.match(/AREA\(m2\):\s*([^\s]+)/);
    const areaConstruccionMatch = claveCatastralData.match(
      /AREA CONSTRUCCION:\s*([^\s]+)/
    );
    const perimetroMatch = claveCatastralData.match(/PERIMETRO:\s*([^\s]+)/);
    const direccionMatch = claveCatastralData.match(
      /DIRECCION:\s*(.*?)\s*ZONIFICACION/
    );
    const usoPredioMatch = claveCatastralData.match(
      /Uso Predio:\s*(.*?)(Lote:|$)/
    );

    let direccion = direccionMatch ? direccionMatch[1].trim() : "";
    direccion = direccion.replace("Foto del Predio", "").trim();

    const datosPredial = {
      totalTerrenos: numList.length,
      predioPrincipal: {
        claveCatastral: claveCatastralMatch ? claveCatastralMatch[1] : "",
        zona: zonaMatch ? zonaMatch[1] : "",
        area_m2: areaMatch ? areaMatch[1] : "",
        areaConstruccion: areaConstruccionMatch ? areaConstruccionMatch[1] : "",
        perimetro: perimetroMatch ? perimetroMatch[1] : "",
        direccion: direccion,
        usoPredio: usoPredioMatch ? usoPredioMatch[1].trim() : "",
      },
    };

    return datosPredial;
  }

  return {};
};

const ConsultaElepco = async (req, res) => {
  const cedula = req.body.cedula;
  const url =
    "http://aplicativos.elepcosa.com.ec:8080/consultaPlanilla/pages/main.jsf";
  const TIMEOUT_MS = 30000; // Tiempo máximo de espera de 30 segundos

  try {
    await initializeBrowser(); // Asegúrate de que esta función está correctamente definida
    const page = await browser.newPage();

    // Promesa de tiempo de espera
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(async () => {
        if (!page.isClosed()) {
          await page.close();
        }
        reject(new Error("Consulta excedió el tiempo límite"));
      }, TIMEOUT_MS);
    });

    // Promesa principal para la consulta
    const consultaPromise = (async () => {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded" });

        // Selección y clic en la opción requerida
        await page.waitForSelector('label[for="j_idt15:console1:0"]', {
          timeout: 5000,
        });
        await page.click('label[for="j_idt15:console1:0"]');

        await page.waitForTimeout(1000);

        // Llenar el formulario con la cédula
        await page.fill('input[id="j_idt15:parametro"]', cedula);
        await page.waitForTimeout(1000);
        await page.click("text=Buscar");
        await page.waitForTimeout(3000);

        // Buscar botones dinámicos
        const buttons = await page.$$(
          'button[name^="frmConsultaPlanilla:j_idt15:"][name$=":btnNuevo"]'
        );

        const allData = [];
        if (buttons.length > 0) {
          for (let i = 0; i < buttons.length; i++) {
            const button = await page.$(
              `button[name="frmConsultaPlanilla:j_idt15:${i}:btnNuevo"]`
            );

            if (button) {
              await button.click();
              await page.waitForTimeout(3000);

              const formData = await extractFormData(page, i, true);
              const tableData = await extractTableData(page);

              allData.push({
                form_data: formData,
                table_data: tableData,
              });
            } else {
              console.warn(`Botón ${i} no está disponible`);
            }
          }
        } else {
          const formData = await extractFormData(page, null, false);
          const tableData = await extractTableData(page);

          allData.push({
            form_data: formData,
            table_data: tableData,
          });
        }

        await page.close();
        return allData;
      } catch (error) {
        if (!page.isClosed()) {
          await page.close();
        }
        throw error;
      }
    })();

    // Espera el resultado de la consulta o el tiempo de espera
    const result = await Promise.race([consultaPromise, timeoutPromise]);
    res.json(result);
  } catch (error) {
    console.error("Error durante la consulta:", error.message);
    res.status(500).json({ error: error.message });
  }
};

async function extractFormData(page, index, hasMultiple) {
  try {
    if (hasMultiple) {
      await page.waitForSelector(
        `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content`,
        { timeout: 10000 }
      );

      return {
        Nombre: await safeTextContent(
          page,
          `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content .ui-g:nth-child(1) .value span`
        ),
        CedulaRUC: await safeTextContent(
          page,
          `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content .ui-g:nth-child(2) .value span`
        ),
        CUEN: await safeTextContent(
          page,
          `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content .ui-g:nth-child(3) .value span`
        ),
        Medidor: await safeTextContent(
          page,
          `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content .ui-g:nth-child(4) .value span`
        ),
        Direccion: await safeTextContent(
          page,
          `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content .ui-g:nth-child(5) .value span`
        ),
        CuentaContrato: await safeTextContent(
          page,
          `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content .ui-g:nth-child(6) .value span`
        ),
        ValorImpago: await safeTextContent(
          page,
          `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content .ui-g:nth-child(7) .value span`
        ),
        Email: await safeTextContent(
          page,
          `#frmConsultaPlanilla\\:j_idt15\\:${index}\\:j_idt16_content .ui-g:nth-child(8) .value span`
        ),
      };
    } else {
      await page.waitForSelector(`#frmConsultaPlanilla\\:j_idt14_content`, {
        timeout: 10000,
      });

      return {
        Nombre: await safeTextContent(
          page,
          "#frmConsultaPlanilla\\:j_idt14_content .ui-g:nth-child(1) .ui-g-11 span:first-child"
        ),
        CedulaRUC: await safeTextContent(
          page,
          "#frmConsultaPlanilla\\:j_idt14_content .ui-g:nth-child(1) .ui-g-11 span:nth-child(2)"
        ),
        CUEN: await safeTextContent(
          page,
          "#frmConsultaPlanilla\\:j_idt14_content .ui-g:nth-child(2) .ui-g-11 span:first-child"
        ),
        Medidor: await safeTextContent(
          page,
          "#frmConsultaPlanilla\\:j_idt14_content .ui-g:nth-child(2) .ui-g-11 span:nth-child(2)"
        ),
        CuentaContrato: await safeTextContent(
          page,
          "#frmConsultaPlanilla\\:j_idt14_content .ui-g:nth-child(3) .ui-g-11 span:first-child"
        ),
        Direccion: await safeTextContent(
          page,
          "#frmConsultaPlanilla\\:j_idt14_content .ui-g:nth-child(3) .ui-g-11 span:nth-child(2)"
        ),
        ValorImpago: await safeTextContent(
          page,
          "#frmConsultaPlanilla\\:j_idt14_content .ui-g:nth-child(4) .ui-g-11 span:first-child"
        ),
        Email: await safeTextContent(
          page,
          "#frmConsultaPlanilla\\:j_idt14_content .ui-g:nth-child(5) .ui-g-11 span"
        ),
      };
    }
  } catch (error) {
    console.error("Error extrayendo datos del formulario:", error.message);
    return {};
  }
}

// Función para extraer datos de la tabla
async function extractTableData(page) {
  try {
    const tableRows = await page.$$(
      "#frmConsultaPlanilla\\:dtDocumentos_data tr"
    );
    const tableData = [];

    for (const row of tableRows) {
      const cells = await row.$$("td");
      const rowData = [];
      for (const cell of cells) {
        rowData.push(await cell.textContent());
      }

      const pdfButton = await row.$('button[id*="btnPdf"]');
      if (pdfButton) {
        const pdfButtonId = await pdfButton.getAttribute("id");
        rowData.push(
          `javascript:PrimeFaces.ab({s:"${pdfButtonId}",f:"frmConsultaPlanilla",p:"frmConsultaPlanilla"});return false;`
        );
      }

      tableData.push(rowData);
    }

    return tableData;
  } catch (error) {
    console.error("Error extrayendo datos de la tabla:", error.message);
    return [];
  }
}

// Función para obtener texto de un selector
async function safeTextContent(page, selector) {
  try {
    const element = await page.$(selector);
    return element ? (await element.textContent()).trim() : "No disponible";
  } catch (error) {
    console.error(
      `Error obteniendo contenido de texto (${selector}):`,
      error.message
    );
    return "No disponible";
  }
}

module.exports = {
  ConsultaAduna,
  ConsultaCompania,
  ConsultaPredial,
  ConsultaElepco,
};
