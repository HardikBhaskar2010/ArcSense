// ArcSense Hardware Diagnostic: Solid HIGH on all LED pins
#define PIN_D7 D7 // GPIO13 (Green LED)
#define PIN_D6 D6 // GPIO12 (Yellow LED)
#define PIN_D0 D0 // GPIO16 (Red LED)

void setup() {
  Serial.begin(115200);

  pinMode(PIN_D7, OUTPUT);
  pinMode(PIN_D6, OUTPUT);
  pinMode(PIN_D0, OUTPUT);

  // Force all pins HIGH (steady 3.3V)
  digitalWrite(PIN_D7, HIGH);
  digitalWrite(PIN_D6, HIGH);
  digitalWrite(PIN_D0, HIGH);

  Serial.println("\n==========================================");
  Serial.println("  ESP8266 SOLID HIGH DIAGNOSTIC ACTIVE   ");
  Serial.println("  D7, D6, and D0 are held continuously at 3.3V");
  Serial.println("==========================================");
}

void loop() {
  // Keep solid HIGH
  digitalWrite(PIN_D7, HIGH);
  digitalWrite(PIN_D6, HIGH);
  digitalWrite(PIN_D0, HIGH);
  delay(1000);
}
