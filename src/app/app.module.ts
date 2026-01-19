import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';

import { AppComponent } from './app.component';
import { MaterialModule } from './material.module';

/**
 * Módulo principal da aplicação
 */
@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    MaterialModule
  ],
  providers: [
    DatePipe,
    CurrencyPipe
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

