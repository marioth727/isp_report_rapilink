
export const SALES_SCRIPTS = {
    "Upgrade Gratis": {
        title: "Categoría A: 10MB → 100MB (Mismo Precio)",
        steps: [
            { label: "Saludo", text: "¡Hola [NOMBRE]! Soy [TU NOMBRE] de Rapilink. ¿Cómo estás? ¿Te encuentras en buen momento?" },
            { label: "Noticia", text: "Te llamo porque tengo una EXCELENTE noticia. Vamos a mejorar tu plan completamente GRATIS." },
            { label: "Beneficio", text: "Pasarás de 10 a 100 megas - ¡10 VECES MÁS VELOCIDAD! - manteniendo tu precio de $69,900." },
            { label: "Cierre", text: "No necesitas hacer nada, el cambio es automático. ¿Tienes alguna pregunta sobre tu mejora?" }
        ]
    },
    "Migración con Ahorro": {
        title: "Categoría B: 30MB → 200MB (Ahorro $10k)",
        steps: [
            { label: "Saludo", text: "¡Hola [NOMBRE]! Soy [TU NOMBRE] de Rapilink. Te traigo una GRAN noticia de actualización." },
            { label: "Beneficio Doble", text: "Aumentamos tu velocidad de 30 a 200 megas (7x más rápido) Y ADEMÁS te ahorras $10,000 al mes." },
            { label: "Precio", text: "Tu nuevo precio será $89,900. Antes pagabas $99,900." },
            { label: "Cierre", text: "¿Te parece bien que hagamos el cambio para que empieces a ahorrar?" }
        ]
    },
    "Migración con Aumento": {
        title: "Categoría C: 5MB → 100MB (Aumento Leve)",
        steps: [
            { label: "Contexto", text: "Tu plan actual será descontinuado y queremos ofrecerte algo MUCHO MEJOR: Plan HOGAR 100MB." },
            { label: "Contraste", text: "Ahora: Videos se cortan. Con 100MB: Todo instantáneo en varios dispositivos." },
            { label: "Precio Ancla", text: "¿Sabes cuánto cuesta? Solo $14,000 pesos más. Menos de $500 pesos al día." },
            { label: "Oferta", text: "Y el SEXTO MES es GRATIS. Pruébalo sin riesgo." },
            { label: "Cierre", text: "¿Hacemos el cambio para que tengas internet rápido de una vez?" }
        ]
    },
    "Obsoletos": {
        title: "Categoría D: Migración Forzosa (Tecnología Antigua)",
        steps: [
            { label: "Notificación", text: "Te informo que tu plan actual será DESCONTINUADO por actualizaciones tecnológicas." },
            { label: "Giro Positivo", text: "Pero tengo una EXCELENTE NOTICIA: Te mejoramos automáticamente al Plan HOGAR 100MB." },
            { label: "Justificación", text: "Esta actualización es NECESARIA para mantener la calidad. Los equipos antiguos ya no soportan la red moderna." },
            { label: "Cierre", text: "La activación es el [FECHA]. ¿Tienes alguna duda?" }
        ]
    },
    "Suspendidos": {
        title: "Recuperación de Suspendidos",
        steps: [
            { label: "Empatía", text: "Hola [NOMBRE], te extrañamos. Queremos ayudarte a reconectarte con una oferta especial." },
            { label: "Oferta", text: "1. Reconexión SIN COSTO ($0).\n2. Upgrade a Plan Mejorado.\n3. Plan de pagos flexible para tu saldo." },
            { label: "Plan de Pagos", text: "Pagas el 30% hoy y el resto en cuotas sin interés en tu factura." },
            { label: "Cierre", text: "¿Quieres que reactive tu servicio ahora mismo? En 2 horas tienes internet." }
        ]
    }
};

export const OBJECTION_HANDLING = {
    "Es muy caro, no puedo pagar más": {
        strategy: "Desglosar costo diario + Valor Ahorro tiempo",
        response: `❌ NUNCA DECIR:
"Es solo un poco más"
"Todo ha subido de precio"
"Si no puedes pagarlo, no hay problema"

✅ RESPUESTA ESTRUCTURADA:
[ESCUCHAR]
"Entiendo tu preocupación, [NOMBRE]. 
La economía está difícil para todos."

[DESGLOSAR]
"Mira, son $[DIFERENCIA÷30] pesos AL DÍA. 
Menos que un café, menos que un pasaje de bus."

[VALOR]
"Y piensa en todo el tiempo que AHORRAS sin esperar 
que carguen las páginas, sin videos que se cortan, 
sin peleas en la casa porque el internet está lento."

[OFERTA]
"Además, el XXX MES es GRATIS. 
Opcional para planes más altos que el actual: Pruébalo sin compromiso. Si no ves que vale la pena, hablamos."`
    },
    "Mi internet actual funciona bien": {
        strategy: "Futuro + Proactividad",
        response: `✅ RESPUESTA:
[VALIDAR]
"Me alegra mucho que no hayas tenido problemas, 
[NOMBRE]. Eso habla bien de tu plan actual."

[FUTURO]
"Pero déjame explicarte algo: Las aplicaciones AHORA 
necesitan mucha más velocidad que hace 2 años."

[EJEMPLOS CONCRETOS]
"TikTok, Instagram con videos, las videollamadas de 
trabajo, las clases online de los niños... todo eso 
necesita más y más velocidad."

[PROACTIVIDAD]
"Estamos siendo PROACTIVOS para que NUNCA tengas 
problemas. No queremos esperar a que empiece a fallar."

[PREGUNTA PODEROSA]
"¿Prefieres actualizar AHORA y el primer 
mes te queda al mismo precio actual, o esperar a que empiece a fallar y ahí sí tener que cambiar de emergencia?"`
    },
    "No uso tanto internet": {
        strategy: "Diagnóstico de uso real",
        response: `✅ RESPUESTA:
[PREGUNTAS DIAGNÓSTICAS]
"Te entiendo. Déjame preguntarte:
- ¿Tienes WhatsApp? ✓
- ¿Ves videos en YouTube o Facebook? ✓
- ¿Usas Netflix o alguna plataforma? ✓
- ¿Tienes familia que también usa internet? ✓"

[REALIDAD]
"¡Eso ES usar mucho internet! Lo que pasa es que 
estamos tan acostumbrados que no nos damos cuenta."

[FAMILIA]
"Y si tienes familia, ellos también usan internet 
AL MISMO TIEMPO que tú."

[BENEFICIO]
"Con 100 megas, todos pueden usarlo sin que NADIE 
se queje de lentitud. Sin peleas, sin 'oye bájale 
al Netflix que estoy en una videollamada'."

[CIERRE]
"Pruébalo 30 días con la misma tarifa. Si realmente no lo 
necesitas, te devuelvo al plan anterior."`
    },
    "Déjame pensarlo / consultarlo": {
        strategy: "Sentido de Urgencia (Cupos limitados)",
        response: `✅ RESPUESTA:
[VALIDAR]
"Por supuesto, [NOMBRE]. Es una decisión importante."

[CLARIFICAR]
"¿Hay algo específico que te preocupa? 
¿El precio, la velocidad, alguna duda técnica?"

[RESOLVER AHÍ MISMO]
"Porque si es [X], déjame aclarártelo ahora mismo..."

[URGENCIA SUAVE]
"Te comento que esta oferta del SEXTO mes gratis 
es SOLO para las primeras [X] personas que migramos 
esta semana."

[ALTERNATIVA]
"¿Qué te parece si te separo el cupo HOY, y si 
consultas con tu familia y no les parece, 
me llamas mañana y lo cancelamos? 
Así no pierdes el beneficio."`
    },
    "Ya me voy a cambiar de empresa": {
        strategy: "Solucionar causa raíz + Comparación",
        response: `✅ RESPUESTA:
[NO ENTRAR EN PÁNICO]
"Entiendo, [NOMBRE]. ¿Puedo preguntarte qué te 
llevó a tomar esa decisión?"

[ESCUCHAR ACTIVAMENTE]
[Dejar que hable - esto es CRÍTICO]

[RESOLVER CAUSA RAÍZ]
"Mira, entiendo que [PROBLEMA]. Por eso precisamente 
te estoy llamando. Con este nuevo plan de 100 megas 
[SOLUCIONA EL PROBLEMA]."

[COMPARACIÓN]
"Las otras empresas te ofrecen [X] megas a [Y] precio.
Nosotros te damos 100 megas a $69,900 con primer mes 
gratis Y ya nos conoces."

[CIERRE EMOCIONAL]
"Llevas [X años/meses] con nosotros. Dame la oportunidad 
de demostrarte que SÍ mejoramos. Si en 30 días no ves 
la diferencia, te ayudo yo mismo a hacer el trámite 
de cancelación. ¿Te parece justo?"`
    },
    "Tengo deudas pendientes": {
        strategy: "Plan de Pagos Flexible",
        response: `✅ RESPUESTA:
[EMPATÍA]
"[NOMBRE], entiendo perfectamente. A todos nos ha 
pasado que los gastos se acumulan."

[SOLUCIÓN]
"Por eso tengo autorización para ofrecerte un 
PLAN DE PAGOS sin intereses."

[DESGLOSE]
"Tu deuda actual es $[MONTO]. Te propongo:
- Pagas $[30%] hoy para activar
- El resto en [3-6] cuotas SIN INTERÉS 
  incluidas en tu factura mensual"

[BENEFICIO]
"Mientras pagas, YA tienes tu internet mejorado 
funcionando. No esperas 3 meses a terminar de pagar."

[URGENCIA]
"Esta facilidad es solo para clientes antiguos 
como tú que queremos que se queden con nosotros."`
    },
    "No tengo tiempo para cambios / instalaciones": {
        strategy: "Cero fricción",
        response: `✅ RESPUESTA:
[TRANQUILIDAD]
"¡Perfecto que menciones eso! Este cambio NO requiere 
instalación ni visita técnica."

[PROCESO]
"Nosotros hacemos el cambio desde acá, desde el sistema.
Solo necesitamos que APAGUES y PRENDAS tu router 
el día [FECHA] en la mañana."

[TIEMPO]
"Son literalmente 5 minutos. Y si tienes algún problema,
te llama directo un técnico para guiarte por teléfono."

[CIERRE]
"Cero complicaciones, cero esperas. ¿Hacemos el cambio?"`
    },
    "Quiero hablar con un supervisor": {
        strategy: "Filtrar y Resolver",
        response: `✅ RESPUESTA:
[SIN DEFENSIVA]
"Por supuesto, [NOMBRE]. Antes de transferirte, 
¿me ayudas entendiendo qué necesitas específicamente?"

[RESOLVER SI ES POSIBLE]
"Porque si es [tema de precio/beneficio/dudas], 
yo tengo autorización para [X]."

[SI INSISTE]
"Sin problema. Te voy a transferir con [NOMBRE 
SUPERVISOR] quien te va a atender en 2 minutos.
Yo le explico tu caso para que no tengas que 
repetir todo. ¿Ok?"

[REGISTRO]
[Anotar en CRM: Cliente escalado - Motivo: X]`
    },
    "Otros vecinos tienen problemas con ustedes": {
        strategy: "Nueva Tecnología",
        response: `✅ RESPUESTA:
[RECONOCER]
"Lamento escuchar eso, [NOMBRE]. ¿Puedes contarme 
qué tipo de problemas tienen?"

[CONTEXTO]
"Déjame explicarte algo: Precisamente POR ESO 
estamos haciendo estas mejoras. Estamos invirtiendo 
en nueva tecnología para que esos problemas 
NO vuelvan a pasar."

[PERSONALIZAR]
"¿TÚ has tenido esos mismos problemas?"

[SI NO] "Perfecto, entonces tu zona funciona bien."
[SI SÍ] "¿Cuándo fue la última vez? [Registrar]"

[COMPROMISO]
"Con este nuevo plan, si llegas a tener CUALQUIER 
problema, yo mismo te doy seguimiento personal.
Te dejo mi número directo."`
    },
    "Me ofrecieron más barato en otra empresa": {
        strategy: "Comparar manzanas con manzanas",
        response: `✅ RESPUESTA:
[INTERÉS GENUINO]
"Ah sí? ¿Qué te ofrecieron exactamente?"

[COMPARACIÓN DETALLADA]
"Mira, comparemos manzanas con manzanas:

Ellos: [X] megas a $[Y]
Nosotros: 100 megas a $69,900

PERO además:
- Nosotros incluimos TV (ellos cobran aparte)
- Ya tienes instalación (ellos cobran $80,000-$150,000)
- Ya nos conoces (con ellos es un riesgo)
- SEXTO mes GRATIS (ellos no)"

[CALCULAR]
"Si sumas TODO, ellos te sale en $[TOTAL] 
y nosotros en $[TOTAL MENOR]."

[CIERRE]
"Además, ¿de qué te sirve que sea $5,000 más barato 
si el servicio es malo? Prefiero pagar un poquito 
más por algo que SÉ que funciona."`
    },
    "No me avisaron de este cambio": {
        strategy: "Trato Personalizado",
        response: `✅ RESPUESTA:
[DISCULPA SINCERA]
"Tienes razón, [NOMBRE]. Por eso te estoy llamando 
YO AHORA, para explicarte todo personalmente."

[EXPLICAR]
"Preferimos llamar a cada cliente para explicarle 
bien, en lugar de solo mandar un mensaje que nadie lee."

[VALORAR]
"Eres un cliente importante para nosotros, por eso 
quiero que entiendas bien los beneficios que vas a 
recibir."

[RETOMAR CONTROL]
"Entonces, déjame explicarte en 2 minutos qué va a 
pasar y cómo te beneficia..."`
    },
    "Antes me dijeron otra cosa": {
        strategy: "Aclarar y Corregir",
        response: `✅ RESPUESTA:
[ESCUCHAR]
"Cuéntame, ¿qué te dijeron exactamente?"

[CLARIFICAR]
"Entiendo la confusión, [NOMBRE]. Déjame aclararte 
la información correcta:"

[SI FUE ERROR NUESTRO]
"Tienes razón, hubo un error de comunicación anterior.
Te pido disculpas por eso. La información correcta 
es [X]."

[SI ES MALENTENDIDO]
"Creo que hubo un malentendido. Lo que te explicaron 
era [X], y lo que te ofrezco ahora es [Y]."

[COMPROMISO]
"Te voy a enviar todo por WhatsApp ahora mismo para 
que lo tengas por escrito. ¿Te parece?"`
    }
};
