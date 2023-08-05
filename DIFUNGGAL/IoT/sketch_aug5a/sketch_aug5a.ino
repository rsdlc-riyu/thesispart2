#include <SoftwareSerial.h>

SoftwareSerial sim900a(18, 19); // RX, TX

void setup() {
  Serial.begin(9600);
  sim900a.begin(9600);

  // Initialize SIM900A module
  delay(1000);
  sim900a.println("AT");
  delay(1000);
  sim900a.println("AT+CMGF=1"); // Set SMS mode to text
  delay(1000);
}

void loop() {
  // Check if there's data available from the Serial port
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n'); // Read the command from the Serial port
    if (command.startsWith("PHONE:") && command.indexOf(", DISTRESS:") != -1) {
      // Parse phone number and distress type from the command
      String phoneStr = command.substring(6, command.indexOf(","));
      String distressType = command.substring(command.indexOf(", DISTRESS:") + 11);
      
      // Send SMS
      sendSMS(phoneStr, distressType);
    }
  }
}

void sendSMS(String phoneNumber, String message) {
  sim900a.println("AT+CMGS=\"" + phoneNumber + "\"");
  delay(1000);
  sim900a.println(message);
  delay(1000);
  sim900a.write(0x1A); // Ctrl+Z
}
